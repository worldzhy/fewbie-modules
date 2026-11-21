#!/usr/bin/env node
/**
 * Type-truth gate: `types.ts` is the source of truth for a module's interface,
 * `item.json`'s `contract` is its executable projection. This script asserts
 * the two agree, so a label, port or ui atom cannot drift between them.
 */
import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const ALLOWED_STATES = new Set(["loading", "error", "empty", "success", "ready"]);
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SEMVER_RANGE = /^(?:[\^~]?\d|[<>=*])/;

const root = process.cwd();
const errors = [];
const checked = [];

function fail(item, message) {
  errors.push(`${item}: ${message}`);
}

function compare(item, field, declared, actual) {
  const expected = [...new Set(declared)].sort();
  const found = [...actual].sort();
  const missing = expected.filter((entry) => !found.includes(entry));
  const extra = found.filter((entry) => !expected.includes(entry));
  if (missing.length > 0) fail(item, `contract.${field} lists ${missing.join(", ")} but types.ts does not`);
  if (extra.length > 0) fail(item, `types.ts exposes ${extra.join(", ")} but contract.${field} does not list it`);
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
      if (entry.name === "test") continue;
      for (const atom of await collectUiAtoms(target)) atoms.add(atom);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const source = await fs.readFile(target, "utf8");
    for (const match of source.matchAll(/from\s+"@\/components\/ui\/([\w-]+)"/g)) atoms.add(match[1]);
  }
  return atoms;
}

async function checkItem(name) {
  const directory = path.join(root, name);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "item.json"), "utf8"));
  const contract = manifest.contract;
  if (contract === undefined) {
    fail(name, "item.json has no contract");
    return;
  }

  if (!SEMVER.test(contract.version)) fail(name, `contract.version '${contract.version}' is not semver`);
  if (!SEMVER_RANGE.test(contract.framework)) fail(name, `contract.framework '${contract.framework}' is not a range`);
  if (!manifest.files.includes(contract.entry))
    fail(name, `contract.entry '${contract.entry}' is not an installed file`);
  const entryPath = path.join(directory, contract.entry);
  await fs.access(entryPath).catch(() => fail(name, `contract.entry '${contract.entry}' does not exist`));

  for (const state of contract.states) {
    if (!ALLOWED_STATES.has(state)) fail(name, `contract.states '${state}' is not allowed`);
  }

  const typesPath = path.join(directory, "src", "modules", name, "types.ts");
  const facts = interfaceFacts(typesPath, await fs.readFile(typesPath, "utf8"));
  compare(name, "labels", contract.labels, facts.labels);
  compare(name, "ports", contract.ports, facts.ports);

  const atoms = await collectUiAtoms(path.join(directory, "src"));
  compare(name, "ui", contract.ui, atoms);

  checked.push(name);
}

const entries = await fs.readdir(root, { withFileTypes: true });
for (const entry of entries) {
  if (
    !entry.isDirectory() ||
    entry.name.startsWith(".") ||
    ["harness", "node_modules", "scripts"].includes(entry.name)
  ) {
    continue;
  }
  const hasManifest = await fs
    .access(path.join(root, entry.name, "item.json"))
    .then(() => true)
    .catch(() => false);
  if (hasManifest) await checkItem(entry.name);
}

if (errors.length > 0) {
  console.error(`Contract check failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ ${checked.length} item contract(s) match their types.ts interface: ${checked.sort().join(", ")}`);
