#!/usr/bin/env node
/**
 * Type-truth gate: `types.ts` is the source of truth for a module's interface,
 * `item.json`'s `contract` is its executable projection. This script asserts
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
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SEMVER_RANGE = /^(?:[\^~]?\d|[<>=*])/;
/** Root directories that are registry infrastructure, never item candidates. */
const ROOT_INFRASTRUCTURE = new Set(["harness", "node_modules", "scripts"]);
/** Item-private directories that are not part of the installable payload. */
const ITEM_INFRASTRUCTURE = new Set(["test", "node_modules"]);

const root = process.cwd();
const errors = [];
const warnings = [];
const checked = [];

function fail(item, message) {
  errors.push(`${item}: ${message}`);
}

function warn(item, message) {
  warnings.push(`${item}: ${message}`);
}

function compare(item, field, declared, actual) {
  const expected = [...new Set(declared)].sort();
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
      if (relative === "item.json") continue;
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
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "item.json"), "utf8"));
  if (manifest.name !== name) {
    fail(name, `item.json name '${manifest.name}' does not match its directory '${name}'`);
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

  const contract = manifest.contract;
  if (contract === undefined) {
    warn(name, "item.json has no contract; contract checks skipped");
    checked.push(name);
    return;
  }

  if (!SEMVER.test(contract.version)) fail(name, `contract.version '${contract.version}' is not semver`);
  if (!SEMVER_RANGE.test(contract.framework)) fail(name, `contract.framework '${contract.framework}' is not a range`);
  const entry = normalizeFile(name, contract.entry);
  if (entry === undefined || !declared.includes(entry))
    fail(name, `contract.entry '${contract.entry}' is not an installed file`);

  for (const state of contract.states) {
    if (!ALLOWED_STATES.has(state)) fail(name, `contract.states '${state}' is not allowed`);
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

const entries = await fs.readdir(root, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith(".") || ROOT_INFRASTRUCTURE.has(entry.name)) {
    continue;
  }
  const hasManifest = await fs
    .access(path.join(root, entry.name, "item.json"))
    .then(() => true)
    .catch(() => false);
  if (hasManifest) await checkItem(entry.name);
}

if (warnings.length > 0) {
  console.warn(`Contract check warnings:\n  ${warnings.join("\n  ")}`);
}

if (errors.length > 0) {
  console.error(`Contract check failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ ${checked.length} item contract(s) match their types.ts interface: ${checked.sort().join(", ")}`);
