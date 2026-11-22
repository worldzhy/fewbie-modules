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
    item.manifest.type = "registry:block";
    const result = await runGate([item]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("type 'registry:block' is not one of");
  });
});

describe("check-contract type and boundary gate", () => {
  it("fails when a feature declares no contract", async () => {
    const result = await runGate([
      {
        name: "feature",
        manifest: { name: "feature", type: "registry:feature", files: ["src/features/feature/index.ts"] },
        files: { "src/features/feature/index.ts": "export const feature = 1;\n" },
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("registry:feature items must declare a contract");
  });

  it("looks for a widget's types.ts under src/widgets, not src/features", async () => {
    const result = await runGate([
      {
        name: "misfiled",
        manifest: {
          name: "misfiled",
          type: "registry:widget",
          files: ["src/features/misfiled/types.ts", "src/features/misfiled/index.ts"],
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
          "src/features/misfiled/types.ts": "export interface MisfiledLabels {}\n",
          "src/features/misfiled/index.ts": "export const misfiled = 1;\n",
        },
      },
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("'src/widgets/misfiled/types.ts' does not exist");
  });

  it("fails when a feature imports a widget", async () => {
    const result = await runGate([
      {
        name: "reverse",
        manifest: { name: "reverse", type: "registry:feature", files: ["src/features/reverse/index.ts"] },
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
