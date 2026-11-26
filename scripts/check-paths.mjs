#!/usr/bin/env node
/**
 * Ensures every cross-module import has an explicit entry in tsconfig.json
 * compilerOptions.paths. Module-internal relative imports don't need paths, but
 * when module A writes `import { x } from "@/fewbie/modules/B/lib/thing"`, tsc
 * needs a paths key — there are no wildcards and TypeScript allows only one
 * `*` per path entry (R84-06).
 *
 * Usage: run alongside check:contract via `npm run check:contract` or as a
 * separate CI step. Exit 0 when every cross-module import resolves; exit 2
 * otherwise with one line per missing path.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const MODULES_DIR = path.join(ROOT, "packages", "modules");
const TSCONFIG_PATH = path.join(ROOT, "tsconfig.json");

// Parse tsconfig.json (may contain comments) via TypeScript's own parser.
const configFile = ts.readConfigFile(TSCONFIG_PATH, (p) => fs.readFileSync(p, "utf8"));
const parseHost = {
  useCaseSensitiveFileNames: true,
  readDirectory: () => [],
  fileExists: () => true,
  readFile: (f) => fs.readFileSync(f, "utf8"),
  getCurrentDirectory: () => ROOT,
  getDirectories: () => [],
};
const parsed = ts.parseJsonConfigFileContent(configFile.config, parseHost, path.dirname(TSCONFIG_PATH));
const paths = new Set(Object.keys(parsed.options.paths || {}));

// Parse every manifest and collect module names + files.
const manifests = [];
for (const name of fs.readdirSync(MODULES_DIR)) {
  const mfPath = path.join(MODULES_DIR, name, "fewbie.module.json");
  if (!fs.existsSync(mfPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(mfPath, "utf8"));
  manifests.push({ name, manifest });
}
const moduleNames = new Set(manifests.map((m) => m.name));

// Find every cross-module import: module A importing @/fewbie/modules/<B>/...
// Use a regex that handles both quote styles without unbalanced character classes.
const IMPORT_RE = /\bfrom\s+(?:"|')(@\/fewbie\/modules\/([^/]+)\/[^"']+)(?:"|')/g;
const errors = [];

for (const { name, manifest } of manifests) {
  for (const file of manifest.files || []) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    // manifest.files is install-target form "src/fewbie/modules/<name>/lib/x.ts"
    // strip the install root "src/fewbie/modules/<name>/" to get storage path.
    const storage = file.replace(/^src\/fewbie\/modules\/[^/]+/, "");
    const sourcePath = path.join(MODULES_DIR, name, storage);
    const source = fs.readFileSync(sourcePath, "utf8");

    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1];
      const targetModule = match[2];
      if (targetModule === name || !moduleNames.has(targetModule)) continue;

      if (!paths.has(specifier)) {
        errors.push(
          `${name}/${path.basename(file)}: imports '${specifier}' but tsconfig.json compilerOptions.paths has no entry for it`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Paths check failed:\n  ${errors.join("\n  ")}`);
  process.exit(2);
}
console.log(`✓ cross-module imports all resolve via tsconfig.json paths`);
