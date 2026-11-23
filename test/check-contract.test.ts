import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

/**
 * Negative fixtures for the registry's only integrity gate. Each case builds a
 * throwaway item set, points `scripts/check-contract.mjs` at it through
 * `FEWBIE_CONTRACT_ROOT`, and asserts the concrete failure or warning. Without
 * these the gate could regress silently and only reveal itself on a real item.
 */
const execFileAsync = promisify(execFile);
const gate = path.resolve(process.cwd(), "scripts/check-contract.mjs");
const temporaryRoots: string[] = [];

interface FixtureItem {
  name: string;
  manifest: Record<string, unknown>;
  files: Record<string, string>;
}

function libItem(name: string, files: Record<string, string>, extra: Record<string, unknown> = {}): FixtureItem {
  return {
    name,
    manifest: { name, type: "registry:lib", files: Object.keys(files), ...extra },
    files,
  };
}

/**
 * A feature with the minimum payload a contract needs: one labels interface,
 * one entry file and a contract that matches both. Overrides narrow a test to
 * the rule it exercises.
 */
function featureItem(
  name: string,
  files: Record<string, string> = {},
  contract: Record<string, unknown> = {},
): FixtureItem {
  const payload = {
    [`src/features/${name}/types.ts`]: `export interface ${name}Labels {\n  title: string;\n}\n`,
    [`src/features/${name}/index.ts`]: "export const value = 1;\n",
    ...files,
  };
  return {
    name,
    manifest: {
      name,
      type: "registry:block",
      files: Object.keys(payload),
      contract: {
        version: "1.0.0",
        framework: "^1.0.0",
        entry: `src/features/${name}/index.ts`,
        labels: ["title"],
        ports: [],
        ui: [],
        states: ["ready"],
        ...contract,
      },
    },
    files: payload,
  };
}

interface GateResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runGate(items: FixtureItem[]): Promise<GateResult> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fewbie-contract-"));
  temporaryRoots.push(directory);
  const root = path.join(directory, "items");
  for (const item of items) {
    const itemDirectory = path.join(root, item.name);
    await fs.mkdir(itemDirectory, { recursive: true });
    await fs.writeFile(path.join(itemDirectory, "fewbie.module.json"), JSON.stringify(item.manifest, null, 2));
    for (const [file, source] of Object.entries(item.files)) {
      const target = path.join(itemDirectory, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, source);
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [gate], {
      cwd: directory,
      env: { ...process.env, FEWBIE_CONTRACT_ROOT: root },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("check-contract structural gate", () => {
  it("accepts a structurally valid item", async () => {
    const result = await runGate([libItem("ok", { "src/lib/ok.ts": "export const ok = 1;\n" })]);
    expect(result.code).toBe(0);
  });

  it("fails when a declared file is missing", async () => {
    const result = await runGate([
      {
        name: "gap",
        manifest: { name: "gap", type: "registry:lib", files: ["src/lib/gap.ts"] },
        files: {},
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("'src/lib/gap.ts' does not exist in the item directory");
  });

  it("fails when files escape the item directory", async () => {
    const result = await runGate([libItem("escape", { "../escape.ts": "export const x = 1;\n" })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("escapes the item directory");
  });

  it("fails when files use an absolute path", async () => {
    const result = await runGate([libItem("absolute", { "/tmp/absolute.ts": "export const x = 1;\n" })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("must be a project-relative path");
  });

  it("fails when the manifest name disagrees with the directory", async () => {
    const item = libItem("alpha", { "src/lib/alpha.ts": "export const x = 1;\n" });
    item.manifest.name = "beta";
    const result = await runGate([item]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("does not match its directory 'alpha'");
  });

  it("fails when an item ships an undeclared file", async () => {
    const item = libItem("extra", { "src/lib/extra.ts": "export const x = 1;\n" });
    item.files["src/lib/stray.ts"] = "export const y = 1;\n";
    const result = await runGate([item]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("item directory ships src/lib/stray.ts");
  });

  it("fails when the manifest type is unknown", async () => {
    const item = libItem("legacy", { "src/lib/legacy.ts": "export const x = 1;\n" });
    item.manifest.type = "registry:widget";
    const result = await runGate([item]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("type 'registry:widget' is not one of");
  });
});

describe("check-contract type and boundary gate", () => {
  it("fails when a block declares no contract", async () => {
    const result = await runGate([
      {
        name: "feature",
        manifest: { name: "feature", type: "registry:block", files: ["src/features/feature/index.ts"] },
        files: { "src/features/feature/index.ts": "export const feature = 1;\n" },
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("registry:block items must declare a contract");
  });

  it("resolves types.ts beside the entry file's layer, not wherever it was filed", async () => {
    const result = await runGate([
      {
        name: "misfiled",
        manifest: {
          name: "misfiled",
          type: "registry:block",
          files: ["src/widgets/misfiled/types.ts", "src/features/misfiled/index.ts"],
          contract: {
            version: "1.0.0",
            framework: "^1.0.0",
            entry: "src/features/misfiled/index.ts",
            labels: [],
            ports: [],
            ui: [],
            states: ["ready"],
          },
        },
        files: {
          "src/widgets/misfiled/types.ts": "export interface MisfiledLabels {}\n",
          "src/features/misfiled/index.ts": "export const misfiled = 1;\n",
        },
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("'src/features/misfiled/types.ts' does not exist");
  });

  it("fails when a feature imports a widget", async () => {
    const result = await runGate([
      {
        name: "reverse",
        manifest: { name: "reverse", type: "registry:block", files: ["src/features/reverse/index.ts"] },
        files: {
          "src/features/reverse/index.ts": 'import { dock } from "@/widgets/copilot";\nexport const reverse = dock;\n',
        },
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("widgets compose features, never the reverse");
  });

  it("fails when an import is not declared in dependencies", async () => {
    const result = await runGate([
      libItem("undeclared", {
        "src/lib/undeclared.ts": 'import leftPad from "left-pad";\nexport const x = leftPad;\n',
      }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("manifest.dependencies does not declare 'left-pad'");
  });

  it("accepts an import declared in dependencies", async () => {
    const result = await runGate([
      libItem(
        "declared",
        { "src/lib/declared.ts": 'import leftPad from "left-pad";\nexport const x = leftPad;\n' },
        { dependencies: ["left-pad@^1.3.0"] },
      ),
    ]);
    expect(result.code).toBe(0);
  });

  it("rejects a host package even when it is declared", async () => {
    const result = await runGate([
      libItem(
        "host",
        { "src/lib/host.ts": 'import Link from "next/link";\nexport const x = Link;\n' },
        { dependencies: ["next@16.0.0"] },
      ),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("imports host package 'next'");
  });
});

describe("check-contract install parity gate", () => {
  it("accepts a contract the CLI parser accepts", async () => {
    const result = await runGate([featureItem("valid")]);
    expect(result.code).toBe(0);
  });

  it("fails when contract.framework is not a semver range", async () => {
    const result = await runGate([featureItem("range", {}, { framework: ">>>" })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("is not a semver range");
  });

  it("fails when contract.framework excludes the shipping CLI", async () => {
    const result = await runGate([featureItem("future", {}, { framework: "^99.0.0" })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("excludes the shipping CLI");
  });

  it("fails when contract.labels is empty", async () => {
    const result = await runGate([featureItem("nolabels", {}, { labels: [] })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("contract.labels must not be empty");
  });

  it("fails when contract.states is empty", async () => {
    const result = await runGate([featureItem("nostates", {}, { states: [] })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("contract.states must not be empty");
  });

  it("fails when a port is not a method name", async () => {
    const result = await runGate([featureItem("badport", {}, { ports: ["not a method"] })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("is not a method name");
  });

  it("fails when a lib item installs into a feature directory", async () => {
    const result = await runGate([
      libItem("misplaced", { "src/features/misplaced/index.ts": "export const x = 1;\n" }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("must land under src/lib/ or src/components/");
  });

  it("fails when files repeats an entry", async () => {
    const item = libItem("dup", { "src/lib/dup.ts": "export const d = 1;\n" });
    item.manifest.files = ["src/lib/dup.ts", "src/lib/dup.ts"];
    const result = await runGate([item]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("files declares 'src/lib/dup.ts' more than once");
  });

  it("reads single-quoted imports too", async () => {
    const result = await runGate([
      libItem("quoted", { "src/lib/quoted.ts": "import leftPad from 'left-pad';\nexport const x = leftPad;\n" }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("manifest.dependencies does not declare 'left-pad'");
  });

  it("fails when a feature reaches a widget through a relative path", async () => {
    const result = await runGate([
      featureItem("relative", {
        "src/features/relative/index.ts": 'import { dock } from "../../widgets/copilot";\nexport const value = dock;\n',
      }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("widgets compose features, never the reverse");
  });

  it("accepts a relative import inside the item", async () => {
    const result = await runGate([
      featureItem("inside", {
        "src/features/inside/index.ts": 'import { value } from "./types";\nexport const other = value;\n',
      }),
    ]);
    expect(result.code).toBe(0);
  });

  it("fails when a relative import escapes the project root", async () => {
    const result = await runGate([
      libItem("leak", { "src/lib/leak.ts": 'import x from "../../../outside";\nexport const y = x;\n' }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("escapes the project root");
  });

  it("accepts a relative import provided by a registry dependency", async () => {
    const result = await runGate([
      libItem(
        "consumer",
        { "src/lib/consumer.ts": 'import { p } from "./provider";\nexport const c = p;\n' },
        { registryDependencies: ["provider"] },
      ),
      libItem("provider", { "src/lib/provider.ts": "export const p = 1;\n" }),
    ]);
    expect(result.code).toBe(0);
  });
});

describe("check-contract dependency graph gate", () => {
  it("fails on a registryDependencies cycle", async () => {
    const result = await runGate([
      libItem("a", { "src/lib/a.ts": "export const a = 1;\n" }, { registryDependencies: ["b"] }),
      libItem("b", { "src/lib/b.ts": "export const b = 1;\n" }, { registryDependencies: ["a"] }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("registryDependencies form a cycle: a -> b -> a");
  });

  it("warns when a registry dependency is never imported", async () => {
    const result = await runGate([
      libItem("consumer", { "src/lib/consumer.ts": "export const c = 1;\n" }, { registryDependencies: ["provider"] }),
      libItem("provider", { "src/lib/provider.ts": "export const p = 1;\n" }),
    ]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("registryDependencies lists 'provider' but no installed file imports it");
  });

  it("stays quiet when the dependency provides an import", async () => {
    const result = await runGate([
      libItem(
        "consumer",
        { "src/lib/consumer.ts": 'import { p } from "@/lib/provider";\nexport const c = p;\n' },
        { registryDependencies: ["provider"] },
      ),
      libItem("provider", { "src/lib/provider.ts": "export const p = 1;\n" }),
    ]);
    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain("no installed file imports it");
  });
});
