#!/usr/bin/env node
/**
 * Type-truth gate: `types.ts` is the source of truth for a module's interface,
 * `fewbie.module.json`'s `contract` is its executable projection. This script asserts
 * the two agree, so a label, port or ui atom cannot drift between them.
 *
 * It also owns the structural invariants of the registry: an item directory is
 * named after its manifest, declares every file it ships, and ships nothing it
 * does not declare. Copy-only payload items (lib/component level) have no
 * contract yet; they still go through the structural checks and only their
 * contract comparison is skipped with a warning.
 */
import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const ALLOWED_STATES = new Set(["loading", "error", "empty", "success", "ready"]);
/**
 * Evidence that a declared state is implemented. Items name states the way
 * their UI does (`pending`, `failed`, `noSessions`), so a plain token match is
 * wrong; each state accepts its common spellings (R82-14). `ready` is the
 * default rendered view and has no separate token, hence no pattern.
 */
const STATE_EVIDENCE = {
  loading: /(loading|pending|submitting|isFetching|skeleton)/i,
  error: /(error|failed|failure|isError)/i,
  empty: /(\bempty\b|\bno[A-Z][A-Za-z0-9]*\b|!\s*\w+\??\.length\b|\.length\s*===?\s*0)/,
  success: /(success|succeeded|isSuccess)/i,
  ready: undefined,
};
/**
 * shadcn/ui primitives the framework ships. An item renders against this list
 * only; a new primitive must be added here (and to the template) deliberately.
 */
const ALLOWED_UI = new Set([
  "alert",
  "alert-dialog",
  "avatar",
  "badge",
  "button",
  "card",
  "checkbox",
  "dialog",
  "dropdown-menu",
  "input",
  "label",
  "progress",
  "select",
  "separator",
  "sheet",
  "skeleton",
  "switch",
  "table",
  "tabs",
  "textarea",
  "tooltip",
]);
/**
 * Package names the framework runtime or the shadcn-initialized template always
 * provide. Any other bare import must be declared in `dependencies`, otherwise a
 * host installs the item and its build fails on the missing package (R82-13).
 */
const FRAMEWORK_PACKAGES = new Set([
  "class-variance-authority",
  "clsx",
  "lucide-react",
  "radix-ui",
  "react",
  "react-dom",
  "tailwind-merge",
]);
/**
 * Host runtime packages an item must never import. They only exist inside a
 * Next.js host, so depending on one would make the item installable in that
 * host only; declaring the dependency is not an escape hatch (R84-03).
 */
const HOST_PACKAGES = new Set(["next"]);
/**
 * Alias targets the template owns. Items may import them without a registry
 * dependency because no item ships them; the coupling is declared here so a new
 * framework path is a reviewed change rather than an invisible one (R82-13).
 */
const FRAMEWORK_MODULES = new Set(["@/lib/api-client", "@/lib/utils"]);
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SEMVER_RANGE = /^(?:[\^~]?\d|[<>=*])/;
/** Container directory holding every authored item (ADR-059). */
const ITEMS_DIR = path.join("packages", "modules");
/** Item-private directories that are not part of the installable payload. */
const ITEM_INFRASTRUCTURE = new Set(["test", "node_modules"]);

const root = path.join(process.cwd(), ITEMS_DIR);
const errors = [];
const warnings = [];
const checked = [];
const skipped = [];
/** Parsed manifest of every item, keyed by directory name (built before checks). */
const manifests = new Map();

function fail(item, message) {
  errors.push(`${item}: ${message}`);
}

function warn(item, message) {
  warnings.push(`${item}: ${message}`);
}

function duplicates(list) {
  const seen = new Set();
  const repeated = new Set();
  for (const entry of list) {
    if (seen.has(entry)) repeated.add(entry);
    seen.add(entry);
  }
  return [...repeated];
}

function compare(item, field, declared, actual) {
  // A duplicate is a real defect: the host would be asked for the same label or
  // port twice, and a Set-based comparison used to hide it (R82-14).
  const declaredDuplicates = duplicates(declared);
  if (declaredDuplicates.length > 0) fail(item, `contract.${field} repeats ${declaredDuplicates.join(", ")}`);
  const actualDuplicates = duplicates([...actual]);
  if (actualDuplicates.length > 0) fail(item, `types.ts ${field} repeats ${actualDuplicates.join(", ")}`);

  const expected = [...declared].sort();
  const found = [...actual].sort();
  const missing = expected.filter((entry) => !found.includes(entry));
  const extra = found.filter((entry) => !expected.includes(entry));
  if (missing.length > 0) fail(item, `contract.${field} lists ${missing.join(", ")} but types.ts does not`);
  if (extra.length > 0) fail(item, `types.ts exposes ${extra.join(", ")} but contract.${field} does not list it`);
}

function comparePayload(item, declared, actual) {
  const expected = [...new Set(declared)].sort();
  const found = [...actual].sort();
  const missing = expected.filter((entry) => !found.includes(entry));
  const extra = found.filter((entry) => !expected.includes(entry));
  if (missing.length > 0) fail(item, `files lists ${missing.join(", ")} but the item directory does not contain them`);
  if (extra.length > 0) fail(item, `item directory ships ${extra.join(", ")} but files does not declare them`);
}

function memberName(member) {
  return member.name && ts.isIdentifier(member.name) ? member.name.text : undefined;
}

function interfaceFacts(fileName, source) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const labels = new Set();
  const portMethods = new Set();
  const requiredCallbacks = new Set();
  let hasPortInterface = false;

  sourceFile.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node) || node.name === undefined) return;
    const name = node.name.text;
    for (const member of node.members) {
      const field = memberName(member);
      if (field === undefined) continue;
      if (name.endsWith("Labels")) labels.add(field);
      if (name.endsWith("Port")) {
        hasPortInterface = true;
        portMethods.add(field);
      }
      if (name.endsWith("Props")) {
        const isCallback =
          ts.isMethodSignature(member) ||
          (ts.isPropertySignature(member) && member.type !== undefined && ts.isFunctionTypeNode(member.type));
        // Optional callbacks are host conveniences, not the module's port.
        if (isCallback && member.questionToken === undefined) requiredCallbacks.add(field);
      }
    }
  });

  return { labels, ports: hasPortInterface ? portMethods : requiredCallbacks };
}

async function collectUiAtoms(directory) {
  const atoms = new Set();
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ITEM_INFRASTRUCTURE.has(entry.name)) continue;
      for (const atom of await collectUiAtoms(target)) atoms.add(atom);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const source = await fs.readFile(target, "utf8");
    for (const match of source.matchAll(/from\s+"@\/components\/ui\/([\w-]+)"/g)) atoms.add(match[1]);
  }
  return atoms;
}

/** Read the declared payload's TypeScript sources (test dir excluded). */
async function declaredSources(directory, files) {
  const sources = [];
  for (const file of files) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = await fs.readFile(path.join(directory, file), "utf8").catch(() => undefined);
    if (source !== undefined) sources.push({ file, source });
  }
  return sources;
}

/** Import specifiers used by the declared payload. */
function importSpecifiers(sources) {
  const specifiers = new Set();
  for (const { source } of sources) {
    for (const match of source.matchAll(/\bfrom\s+"([^"]+)"/g)) specifiers.add(match[1]);
    for (const match of source.matchAll(/\bimport\s+"([^"]+)"/g)) specifiers.add(match[1]);
  }
  return specifiers;
}

function packageName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** A `dependencies` entry carries a version suffix; compare the package only. */
function declaredPackageName(specifier) {
  const scopeEnd = specifier.startsWith("@") ? specifier.indexOf("/") : -1;
  const versionAt = specifier.indexOf("@", scopeEnd + 1);
  return versionAt === -1 ? specifier : specifier.slice(0, versionAt);
}

/** True when some installed file provides the `@/` alias target. */
function aliasIsProvided(target, files) {
  return [...files].some(
    (file) =>
      file === target ||
      file === `${target}.ts` ||
      file === `${target}.tsx` ||
      file === `${target}/index.ts` ||
      file === `${target}/index.tsx`,
  );
}

/**
 * Every import must resolve to something the host will actually have: a
 * framework package, a declared npm dependency, a shadcn primitive, an
 * allowlisted framework module, or a file shipped by the item or one of its
 * registry dependencies (R82-13).
 */
function checkImports(name, manifest, declared, sources) {
  const declaredPackages = new Set((manifest.dependencies ?? []).map((dependency) => declaredPackageName(dependency)));
  const dependencyFiles = new Set();
  for (const dependency of manifest.registryDependencies ?? []) {
    for (const file of manifests.get(dependency)?.files ?? []) dependencyFiles.add(file);
  }

  for (const specifier of importSpecifiers(sources)) {
    if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
    if (specifier.startsWith("@/components/ui/")) {
      const atom = specifier.slice("@/components/ui/".length);
      if (!ALLOWED_UI.has(atom)) fail(name, `imports ui primitive '${atom}', which is not on the framework allowlist`);
      continue;
    }
    if (specifier.startsWith("@/")) {
      if (FRAMEWORK_MODULES.has(specifier)) continue;
      const target = `src/${specifier.slice(2)}`;
      if (aliasIsProvided(target, declared) || aliasIsProvided(target, dependencyFiles)) continue;
      fail(name, `imports '${specifier}' but no installed file or registryDependency provides it`);
      continue;
    }
    const pkg = packageName(specifier);
    if (HOST_PACKAGES.has(pkg)) {
      fail(name, `imports host package '${pkg}'; registry items must not depend on the host framework`);
      continue;
    }
    if (FRAMEWORK_PACKAGES.has(pkg) || declaredPackages.has(pkg)) continue;
    fail(name, `imports '${specifier}' but manifest.dependencies does not declare '${pkg}'`);
  }
}

/** Every installable file under `<item>/`, as project-relative POSIX paths. */
async function payloadFiles(directory) {
  const files = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      const relative = path.relative(directory, target).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (ITEM_INFRASTRUCTURE.has(entry.name)) continue;
        await walk(target);
        continue;
      }
      if (relative === "fewbie.module.json") continue;
      files.push(relative);
    }
  }
  await walk(directory);
  return files;
}

/** Reject absolute or escaping paths; returns the normalized POSIX form. */
function normalizeFile(item, file) {
  if (typeof file !== "string" || file.length === 0) {
    fail(item, "files entries must be non-empty strings");
    return undefined;
  }
  if (path.isAbsolute(file)) {
    fail(item, `files entry '${file}' must be a project-relative path`);
    return undefined;
  }
  const normalized = path.posix.normalize(file);
  if (normalized === ".." || normalized.startsWith("../")) {
    fail(item, `files entry '${file}' escapes the item directory`);
    return undefined;
  }
  return normalized;
}

async function checkItem(name) {
  const directory = path.join(root, name);
  const manifest = manifests.get(name);
  if (manifest.name !== name) {
    fail(name, `fewbie.module.json name '${manifest.name}' does not match its directory '${name}'`);
  }

  const declared = [];
  for (const file of Array.isArray(manifest.files) ? manifest.files : []) {
    const normalized = normalizeFile(name, file);
    if (normalized === undefined) continue;
    declared.push(normalized);
    await fs
      .access(path.join(directory, normalized))
      .catch(() => fail(name, `files entry '${normalized}' does not exist in the item directory`));
  }
  comparePayload(name, declared, await payloadFiles(directory));

  for (const field of ["dependencies", "registryDependencies"]) {
    const list = manifest[field];
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      fail(name, `${field} must be an array`);
      continue;
    }
    for (const entry of list) {
      if (typeof entry !== "string" || entry.length === 0) fail(name, `${field} entries must be non-empty strings`);
    }
  }
  for (const dependency of manifest.registryDependencies ?? []) {
    if (!manifests.has(dependency)) {
      fail(name, `registryDependencies lists '${dependency}', which is not an item in this registry`);
    }
  }

  const sources = await declaredSources(directory, declared);
  checkImports(name, manifest, declared, sources);

  const contract = manifest.contract;
  if (contract === undefined) {
    // A block is a host-facing surface; without a contract its labels, ports
    // and states are unverified. Copy-only lib/component items may skip.
    if (manifest.type === "registry:block") {
      fail(name, "registry:block items must declare a contract");
    } else {
      warn(name, "fewbie.module.json has no contract; contract checks skipped (R79-01)");
    }
    skipped.push(name);
    return;
  }

  if (!SEMVER.test(contract.version)) fail(name, `contract.version '${contract.version}' is not semver`);
  if (!SEMVER_RANGE.test(contract.framework)) fail(name, `contract.framework '${contract.framework}' is not a range`);
  const entry = normalizeFile(name, contract.entry);
  if (entry === undefined || !declared.includes(entry))
    fail(name, `contract.entry '${contract.entry}' is not an installed file`);

  for (const field of ["labels", "ports", "ui", "states"]) {
    if (!Array.isArray(contract[field])) fail(name, `contract.${field} must be an array`);
  }

  for (const state of Array.isArray(contract.states) ? contract.states : []) {
    if (!ALLOWED_STATES.has(state)) fail(name, `contract.states '${state}' is not allowed`);
  }
  for (const atom of Array.isArray(contract.ui) ? contract.ui : []) {
    if (!ALLOWED_UI.has(atom)) fail(name, `contract.ui '${atom}' is not on the framework allowlist`);
  }
  // A state is a behaviour claim, not a vocabulary choice: the payload must
  // actually implement it (R82-14).
  const sourceText = sources.map((source) => source.source).join("\n");
  for (const state of Array.isArray(contract.states) ? contract.states : []) {
    const evidence = STATE_EVIDENCE[state];
    if (evidence !== undefined && !evidence.test(sourceText)) {
      fail(name, `contract.states declares '${state}' but no installed file implements it`);
    }
  }

  const typesPath = path.join(directory, "src", "modules", name, "types.ts");
  const typesSource = await fs.readFile(typesPath, "utf8").catch(() => undefined);
  if (typesSource === undefined) {
    fail(name, `contract is declared but 'src/modules/${name}/types.ts' does not exist`);
    checked.push(name);
    return;
  }

  const facts = interfaceFacts(typesPath, typesSource);
  compare(name, "labels", contract.labels, facts.labels);
  compare(name, "ports", contract.ports, facts.ports);

  const atoms = await collectUiAtoms(path.join(directory, "src"));
  compare(name, "ui", contract.ui, atoms);

  checked.push(name);
}

const itemsRootExists = await fs
  .access(root)
  .then(() => true)
  .catch(() => false);
if (!itemsRootExists) {
  console.error(`Contract check failed: ${ITEMS_DIR} is missing; run this from the registry repository root.`);
  process.exit(1);
}

const entries = await fs.readdir(root, { withFileTypes: true });
const itemNames = [];
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) {
    continue;
  }
  const hasManifest = await fs
    .access(path.join(root, entry.name, "fewbie.module.json"))
    .then(() => true)
    .catch(() => false);
  if (hasManifest) itemNames.push(entry.name);
}
// Parse every manifest first: import checks and registryDependencies validation
// need to see items other than the one being checked.
for (const name of itemNames) {
  manifests.set(name, JSON.parse(await fs.readFile(path.join(root, name, "fewbie.module.json"), "utf8")));
}
for (const name of itemNames) await checkItem(name);

if (warnings.length > 0) {
  console.warn(`Contract check warnings:\n  ${warnings.join("\n  ")}`);
}

if (errors.length > 0) {
  console.error(`Contract check failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✓ ${checked.length} item contract(s) match their types.ts interface: ${checked.sort().join(", ")}${
    skipped.length > 0 ? ` (${skipped.length} item(s) skipped: no contract — ${skipped.sort().join(", ")})` : ""
  }`,
);
