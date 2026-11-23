import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

/**
 * Negative fixtures for the registry's only integrity gate. Each case builds a
 * throwaway module set, points `scripts/check-contract.mjs` at it through
 * `FEWBIE_CONTRACT_ROOT`, and asserts the concrete failure or warning. Without
 * these the gate could regress silently and only reveal itself on a real module.
 */
const execFileAsync = promisify(execFile);
const gate = path.resolve(process.cwd(), "scripts/check-contract.mjs");
const temporaryRoots: string[] = [];

interface FixtureModule {
  name: string;
  manifest: Record<string, unknown>;
  files: Record<string, string>;
}

function libModule(name: string, files: Record<string, string>, extra: Record<string, unknown> = {}): FixtureModule {
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
function featureModule(
  name: string,
  files: Record<string, string> = {},
  contract: Record<string, unknown> = {},
): FixtureModule {
  const payload = {
    [`src/fewbie/modules/${name}/features/${name}/types.ts`]: `export interface ${name}Labels {\n  title: string;\n}\n`,
    [`src/fewbie/modules/${name}/features/${name}/index.ts`]: "export const value = 1;\n",
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
        entry: `src/fewbie/modules/${name}/features/${name}/index.ts`,
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

async function runGate(modules: FixtureModule[]): Promise<GateResult> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fewbie-contract-"));
  temporaryRoots.push(directory);
  const root = path.join(directory, "modules");
  for (const module of modules) {
    const itemDirectory = path.join(root, module.name);
    await fs.mkdir(itemDirectory, { recursive: true });
    await fs.writeFile(path.join(itemDirectory, "fewbie.module.json"), JSON.stringify(module.manifest, null, 2));
    for (const [file, source] of Object.entries(module.files)) {
      // Payload is stored at the install target minus the install root (ADR-071).
      const prefix = `src/fewbie/modules/${module.name}/`;
      const stored = file.startsWith(prefix) ? file.slice(prefix.length) : file;
      const target = path.join(itemDirectory, stored);
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
  it("accepts a structurally valid module", async () => {
    const result = await runGate([libModule("ok", { "src/fewbie/modules/ok/lib/ok.ts": "export const ok = 1;\n" })]);
    expect(result.code).toBe(0);
  });

  it("fails when a declared file is missing", async () => {
    const result = await runGate([
      {
        name: "gap",
        manifest: { name: "gap", type: "registry:lib", files: ["src/fewbie/modules/gap/lib/gap.ts"] },
        files: {},
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("'src/fewbie/modules/gap/lib/gap.ts' does not exist in the module directory");
  });

  it("fails when files escape the module directory", async () => {
    const result = await runGate([libModule("escape", { "../escape.ts": "export const x = 1;\n" })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("escapes the module directory");
  });

  it("fails when files use an absolute path", async () => {
    const result = await runGate([libModule("absolute", { "/tmp/absolute.ts": "export const x = 1;\n" })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("must be a project-relative path");
  });

  it("fails when the manifest name disagrees with the directory", async () => {
    const module = libModule("alpha", { "src/fewbie/modules/alpha/lib/alpha.ts": "export const x = 1;\n" });
    module.manifest.name = "beta";
    const result = await runGate([module]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("does not match its directory 'alpha'");
  });

  it("fails when a module ships an undeclared file", async () => {
    const module = libModule("extra", { "src/fewbie/modules/extra/lib/extra.ts": "export const x = 1;\n" });
    module.files["src/fewbie/modules/extra/lib/stray.ts"] = "export const y = 1;\n";
    const result = await runGate([module]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("module directory ships src/fewbie/modules/extra/lib/stray.ts");
  });

  it("fails when the manifest type is unknown", async () => {
    const module = libModule("legacy", { "src/fewbie/modules/legacy/lib/legacy.ts": "export const x = 1;\n" });
    module.manifest.type = "registry:widget";
    const result = await runGate([module]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("type 'registry:widget' is not one of");
  });
});

describe("check-contract type and boundary gate", () => {
  it("fails when a block declares no contract", async () => {
    const result = await runGate([
      {
        name: "feature",
        manifest: {
          name: "feature",
          type: "registry:block",
          files: ["src/fewbie/modules/feature/features/feature/index.ts"],
        },
        files: { "src/fewbie/modules/feature/features/feature/index.ts": "export const feature = 1;\n" },
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("registry:block modules must declare a contract");
  });

  it("resolves types.ts beside the entry file's layer, not wherever it was filed", async () => {
    const result = await runGate([
      {
        name: "misfiled",
        manifest: {
          name: "misfiled",
          type: "registry:block",
          files: [
            "src/fewbie/modules/misfiled/widgets/misfiled/types.ts",
            "src/fewbie/modules/misfiled/features/misfiled/index.ts",
          ],
          contract: {
            version: "1.0.0",
            framework: "^1.0.0",
            entry: "src/fewbie/modules/misfiled/features/misfiled/index.ts",
            labels: [],
            ports: [],
            ui: [],
            states: ["ready"],
          },
        },
        files: {
          "src/fewbie/modules/misfiled/widgets/misfiled/types.ts": "export interface MisfiledLabels {}\n",
          "src/fewbie/modules/misfiled/features/misfiled/index.ts": "export const misfiled = 1;\n",
        },
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("'src/fewbie/modules/misfiled/features/misfiled/types.ts' does not exist");
  });

  it("fails when a feature imports a widget", async () => {
    const result = await runGate([
      {
        name: "reverse",
        manifest: {
          name: "reverse",
          type: "registry:block",
          files: ["src/fewbie/modules/reverse/features/reverse/index.ts"],
        },
        files: {
          "src/fewbie/modules/reverse/features/reverse/index.ts":
            'import { dock } from "@/fewbie/modules/reverse/widgets/copilot";\nexport const reverse = dock;\n',
        },
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("widgets compose features, never the reverse");
  });

  it("fails when an import is not declared in dependencies", async () => {
    const result = await runGate([
      libModule("undeclared", {
        "src/fewbie/modules/undeclared/lib/undeclared.ts":
          'import leftPad from "left-pad";\nexport const x = leftPad;\n',
      }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("manifest.dependencies does not declare 'left-pad'");
  });

  it("accepts an import declared in dependencies", async () => {
    const result = await runGate([
      libModule(
        "declared",
        {
          "src/fewbie/modules/declared/lib/declared.ts": 'import leftPad from "left-pad";\nexport const x = leftPad;\n',
        },
        { dependencies: ["left-pad@^1.3.0"] },
      ),
    ]);
    expect(result.code).toBe(0);
  });

  it("rejects a host package even when it is declared", async () => {
    const result = await runGate([
      libModule(
        "host",
        { "src/fewbie/modules/host/lib/host.ts": 'import Link from "next/link";\nexport const x = Link;\n' },
        { dependencies: ["next@16.0.0"] },
      ),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("imports host package 'next'");
  });
});

describe("check-contract install parity gate", () => {
  it("accepts a contract the CLI parser accepts", async () => {
    const result = await runGate([featureModule("valid")]);
    expect(result.code).toBe(0);
  });

  it("fails when contract.framework is not a semver range", async () => {
    const result = await runGate([featureModule("range", {}, { framework: ">>>" })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("is not a semver range");
  });

  it("fails when contract.framework excludes the shipping CLI", async () => {
    const result = await runGate([featureModule("future", {}, { framework: "^99.0.0" })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("excludes the shipping CLI");
  });

  it("fails when contract.labels is empty", async () => {
    const result = await runGate([featureModule("nolabels", {}, { labels: [] })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("contract.labels must not be empty");
  });

  it("fails when contract.states is empty", async () => {
    const result = await runGate([featureModule("nostates", {}, { states: [] })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("contract.states must not be empty");
  });

  it("fails when a port is not a method name", async () => {
    const result = await runGate([featureModule("badport", {}, { ports: ["not a method"] })]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("is not a method name");
  });

  it("fails when a lib module installs into a feature directory", async () => {
    const result = await runGate([
      libModule("misplaced", { "src/fewbie/modules/misplaced/features/misplaced/index.ts": "export const x = 1;\n" }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("must land under src/fewbie/modules/misplaced/<lib|components>/");
  });

  it("fails when files repeats an entry", async () => {
    const module = libModule("dup", { "src/fewbie/modules/dup/lib/dup.ts": "export const d = 1;\n" });
    module.manifest.files = ["src/fewbie/modules/dup/lib/dup.ts", "src/fewbie/modules/dup/lib/dup.ts"];
    const result = await runGate([module]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("files declares 'src/fewbie/modules/dup/lib/dup.ts' more than once");
  });

  it("reads single-quoted imports too", async () => {
    const result = await runGate([
      libModule("quoted", {
        "src/fewbie/modules/quoted/lib/quoted.ts": "import leftPad from 'left-pad';\nexport const x = leftPad;\n",
      }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("manifest.dependencies does not declare 'left-pad'");
  });

  it("fails when a feature reaches a widget through a relative path", async () => {
    const result = await runGate([
      featureModule("relative", {
        "src/fewbie/modules/relative/features/relative/index.ts":
          'import { dock } from "../../widgets/copilot";\nexport const value = dock;\n',
      }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("widgets compose features, never the reverse");
  });

  it("accepts a relative import inside the module", async () => {
    const result = await runGate([
      featureModule("inside", {
        "src/fewbie/modules/inside/features/inside/index.ts":
          'import { value } from "./types";\nexport const other = value;\n',
      }),
    ]);
    expect(result.code).toBe(0);
  });

  it("fails when a relative import escapes the project root", async () => {
    const result = await runGate([
      libModule("leak", {
        "src/fewbie/modules/leak/lib/leak.ts": 'import x from "../../../../../../outside";\nexport const y = x;\n',
      }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("escapes the project root");
  });

  it("accepts a relative import provided by a registry dependency", async () => {
    const result = await runGate([
      libModule(
        "consumer",
        {
          "src/fewbie/modules/consumer/lib/consumer.ts":
            'import { p } from "@/fewbie/modules/provider/lib/provider";\nexport const c = p;\n',
        },
        { registryDependencies: ["provider"] },
      ),
      libModule("provider", { "src/fewbie/modules/provider/lib/provider.ts": "export const p = 1;\n" }),
    ]);
    expect(result.code).toBe(0);
  });
});

describe("check-contract dependency graph gate", () => {
  it("fails on a registryDependencies cycle", async () => {
    const result = await runGate([
      libModule("a", { "src/fewbie/modules/a/lib/a.ts": "export const a = 1;\n" }, { registryDependencies: ["b"] }),
      libModule("b", { "src/fewbie/modules/b/lib/b.ts": "export const b = 1;\n" }, { registryDependencies: ["a"] }),
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("registryDependencies form a cycle: a -> b -> a");
  });

  it("warns when a registry dependency is never imported", async () => {
    const result = await runGate([
      libModule(
        "consumer",
        { "src/fewbie/modules/consumer/lib/consumer.ts": "export const c = 1;\n" },
        { registryDependencies: ["provider"] },
      ),
      libModule("provider", { "src/fewbie/modules/provider/lib/provider.ts": "export const p = 1;\n" }),
    ]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("registryDependencies lists 'provider' but no installed file imports it");
  });

  it("stays quiet when the dependency provides an import", async () => {
    const result = await runGate([
      libModule(
        "consumer",
        {
          "src/fewbie/modules/consumer/lib/consumer.ts":
            'import { p } from "@/fewbie/modules/provider/lib/provider";\nexport const c = p;\n',
        },
        { registryDependencies: ["provider"] },
      ),
      libModule("provider", { "src/fewbie/modules/provider/lib/provider.ts": "export const p = 1;\n" }),
    ]);
    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain("no installed file imports it");
  });
});
