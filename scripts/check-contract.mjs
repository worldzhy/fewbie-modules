#!/usr/bin/env node
/**
 * Type-truth gate: `types.ts` is the source of truth for a module's interface,
 * `fewbie.module.json`'s `contract` is its executable projection. This script asserts
 * the two agree, so a label, port or ui atom cannot drift between them.
 *
 * It also owns the structural invariants of the registry: a module directory is
 * named after its manifest, declares every file it ships, and ships nothing it
 * does not declare. Copy-only payload modules (lib/component level) have no
 * contract yet; they still go through the structural checks and only their
 * contract comparison is skipped with a warning.
 */
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import semver from "semver";
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
 * shadcn/ui primitives the framework ships. An module renders against this list
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
  "popover",
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
 * Layers a payload file may occupy (ADR-069 D1). The layer of a file, not the
 * manifest type, decides which tree its contract's `types.ts` lives in.
 */
const LAYERS = ["features", "widgets", "components", "lib"];

/** Layer of a project-relative file, or undefined outside the module-first tree. */
function layerOf(file) {
  const segments = file.split("/");
  return segments[0] === "src" && segments[1] === "fewbie" && segments[2] === "modules" && LAYERS.includes(segments[4])
    ? segments[4]
    : undefined;
}
/**
 * Package names the framework runtime or the shadcn-initialized template always
 * provide. Any other bare import must be declared in `dependencies`, otherwise a
 * host installs the module and its build fails on the missing package (R82-13).
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
 * Host runtime packages a module must never import. They only exist inside a
 * Next.js host, so depending on one would make the module installable in that
 * host only; declaring the dependency is not an escape hatch (R84-03).
 */
const HOST_PACKAGES = new Set(["next"]);
/**
 * Alias targets the template owns. Items may import them without a registry
 * dependency because no module ships them; the coupling is declared here so a new
 * framework path is a reviewed change rather than an invisible one (R82-13).
 */
const FRAMEWORK_MODULES = new Set([
  "@/lib/api-client",
  "@/lib/utils",
  // Domain-neutral page chrome: a featured page composes the same shell, states
  // and confirmation the host already renders, instead of shipping a second copy.
  "@/fewbie/framework/page/page-shell",
  "@/fewbie/framework/page/page-header",
  "@/fewbie/framework/page/section-tabs",
  "@/fewbie/framework/states/loading-state",
  "@/fewbie/framework/states/empty-state",
  "@/fewbie/framework/states/error-state",
  "@/fewbie/framework/feedback/confirm-dialog",
]);
/**
 * Layers each manifest type may install into. A feature stays a feature so host
 * lint sees it as one; a lib may ship a component payload beside its logic
 * (ADR-066). Every payload file lands under the module's own module-first tree
 * (ADR-070 D1); any other landing path would install a file the host layer
 * rules never see, so the gate rejects it here instead of at the first host build.
 */
const TYPE_LAYERS = {
  "registry:block": ["features", "widgets", "components", "lib"],
  "registry:lib": ["lib", "components"],
  "registry:component": ["components", "lib"],
};
const PORT_METHOD = /^[A-Za-z_$][\w$]*$/;
/** Container directory holding every authored module (ADR-059). */
const MODULES_DIR = path.join("packages", "modules");
/** Item-private directories that are not part of the installable payload. */
const MODULE_INFRASTRUCTURE = new Set(["test", "node_modules"]);

/** Project target a declared storage path lands at (ADR-070, ADR-071). */
function installTarget(name, file) {
  return `src/fewbie/modules/${name}/${file}`;
}

/** Storage path of a declared target; undefined when it leaves the module root. */
function storagePath(name, file) {
  const prefix = `src/fewbie/modules/${name}/`;
  return file.startsWith(prefix) ? file.slice(prefix.length) : undefined;
}

// `FEWBIE_CONTRACT_ROOT` lets the fixture suite point the same gate at a
// throwaway registry; production runs keep the repository default.
const root = process.env.FEWBIE_CONTRACT_ROOT
  ? path.resolve(process.env.FEWBIE_CONTRACT_ROOT)
  : path.join(process.cwd(), MODULES_DIR);
/**
 * Version of the CLI hosts actually run. A framework range can be well-formed
 * and still exclude that CLI, in which case the module passes this gate and then
 * fails to install (R87-01). The CLI is a dev dependency: the gate asks the
 * same question an install asks, against the released version rather than this
 * repository's working tree.
 */
const CLI_VERSION = (() => {
  try {
    return createRequire(import.meta.url)("@devbie/fewbie-cli/package.json").version;
  } catch {
    return undefined;
  }
})();
const errors = [];
const warnings = [];
const checked = [];
const skipped = [];
/** Parsed manifest of every module, keyed by directory name (built before checks). */
const manifests = new Map();
/** Declared payload sources of every module, keyed by directory name. */
const moduleSources = new Map();

function fail(module, message) {
  errors.push(`${module}: ${message}`);
}

function warn(module, message) {
  warnings.push(`${module}: ${message}`);
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

function compare(module, field, declared, actual) {
  // A duplicate is a real defect: the host would be asked for the same label or
  // port twice, and a Set-based comparison used to hide it (R82-14).
  const declaredDuplicates = duplicates(declared);
  if (declaredDuplicates.length > 0) fail(module, `contract.${field} repeats ${declaredDuplicates.join(", ")}`);
  const actualDuplicates = duplicates([...actual]);
  if (actualDuplicates.length > 0) fail(module, `types.ts ${field} repeats ${actualDuplicates.join(", ")}`);

  const expected = [...declared].sort();
  const found = [...actual].sort();
  const missing = expected.filter((entry) => !found.includes(entry));
  const extra = found.filter((entry) => !expected.includes(entry));
  if (missing.length > 0) fail(module, `contract.${field} lists ${missing.join(", ")} but types.ts does not`);
  if (extra.length > 0) fail(module, `types.ts exposes ${extra.join(", ")} but contract.${field} does not list it`);
}

function comparePayload(module, declared, actual) {
  const expected = [...new Set(declared)].sort();
  const found = [...actual].sort();
  const missing = expected.filter((entry) => !found.includes(entry));
  const extra = found.filter((entry) => !expected.includes(entry));
  if (missing.length > 0)
    fail(module, `files lists ${missing.join(", ")} but the module directory does not contain them`);
  if (extra.length > 0) fail(module, `module directory ships ${extra.join(", ")} but files does not declare them`);
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
      if (MODULE_INFRASTRUCTURE.has(entry.name)) continue;
      for (const atom of await collectUiAtoms(target)) atoms.add(atom);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const source = await fs.readFile(target, "utf8");
    for (const match of source.matchAll(/from\s+["']@\/fewbie\/ui\/([\w-]+)["']/g)) atoms.add(match[1]);
  }
  return atoms;
}

/** Read the declared payload's TypeScript sources (test dir excluded). */
async function declaredSources(name, directory, files) {
  const sources = [];
  for (const file of files) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const storage = storagePath(name, file);
    if (storage === undefined) continue;
    const source = await fs.readFile(path.join(directory, storage), "utf8").catch(() => undefined);
    if (source !== undefined) sources.push({ file, source });
  }
  return sources;
}

/**
 * Import specifiers used by the declared payload, paired with the file that
 * imports them so relative targets can be resolved. Both quote styles count:
 * a module could otherwise skip the whole check by switching quotes (R87-03).
 */
function importSpecifiers(sources) {
  const specifiers = [];
  for (const { file, source } of sources) {
    for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) specifiers.push({ file, specifier: match[1] });
    for (const match of source.matchAll(/\bimport\s+["']([^"']+)["']/g)) specifiers.push({ file, specifier: match[1] });
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
 * Project-relative target of an alias or relative specifier. Both forms must be
 * resolved, because a relative path names the same layer without naming it
 * (R87-03); package specifiers have no project target.
 */
function resolveTarget(file, specifier) {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith(".")) return undefined;
  return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
}

/** Project-relative targets of the module's own imports (framework ones excluded). */
function importedTargets(sources) {
  const targets = new Set();
  for (const { file, specifier } of importSpecifiers(sources)) {
    if (specifier.startsWith("@/") && (FRAMEWORK_MODULES.has(specifier) || specifier.startsWith("@/fewbie/ui/"))) {
      continue;
    }
    const target = resolveTarget(file, specifier);
    if (target !== undefined) targets.add(target);
  }
  return targets;
}

/**
 * Every import must resolve to something the host will actually have: a
 * framework package, a declared npm dependency, a shadcn primitive, an
 * allowlisted framework module, or a file shipped by the module or one of its
 * registry dependencies (R82-13).
 */
function checkImports(name, manifest, declared, sources) {
  const declaredPackages = new Set((manifest.dependencies ?? []).map((dependency) => declaredPackageName(dependency)));
  const dependencyFiles = new Set();
  for (const dependency of manifest.registryDependencies ?? []) {
    for (const file of manifests.get(dependency)?.files ?? []) dependencyFiles.add(file);
  }

  for (const { file, specifier } of importSpecifiers(sources)) {
    if (specifier.startsWith("node:")) continue;
    const target = resolveTarget(file, specifier);
    if (target !== undefined) {
      if (target === ".." || target.startsWith("../")) {
        fail(name, `'${file}' imports '${specifier}', which escapes the project root`);
        continue;
      }
      if (layerOf(file) === "features" && layerOf(target) === "widgets") {
        fail(
          name,
          `feature files must not import '${specifier}' (${file}); widgets compose features, never the reverse (ADR-069 D4)`,
        );
        continue;
      }
      if (layerOf(file) === "components" && ["features", "widgets"].includes(layerOf(target))) {
        fail(
          name,
          `component files must not import '${specifier}' (${file}); shared presentation stays below features and widgets (ADR-069 D4)`,
        );
        continue;
      }
      if (layerOf(file) === "lib" && ["features", "widgets"].includes(layerOf(target))) {
        fail(name, `lib files must not import '${specifier}' (${file}); lib is the bottom layer (ADR-069 D4)`);
        continue;
      }
      if (target.startsWith("src/fewbie/ui/")) {
        const atom = target.slice("src/fewbie/ui/".length);
        if (!ALLOWED_UI.has(atom))
          fail(name, `imports ui primitive '${atom}', which is not on the framework allowlist`);
        continue;
      }
      if (FRAMEWORK_MODULES.has(`@/${target.slice(4)}`)) continue;
      if (aliasIsProvided(target, declared) || aliasIsProvided(target, dependencyFiles)) continue;
      fail(
        name,
        `imports '${specifier}' from '${file}' but no installed file or registryDependency provides '${target}'`,
      );
      continue;
    }
    const pkg = packageName(specifier);
    if (HOST_PACKAGES.has(pkg)) {
      fail(name, `imports host package '${pkg}'; registry modules must not depend on the host framework`);
      continue;
    }
    if (FRAMEWORK_PACKAGES.has(pkg) || declaredPackages.has(pkg)) continue;
    fail(name, `imports '${specifier}' but manifest.dependencies does not declare '${pkg}'`);
  }
}

/** Every installable file under `<module>/`, as project-relative POSIX targets. */
async function payloadFiles(name, directory) {
  const files = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      const relative = path.relative(directory, target).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (MODULE_INFRASTRUCTURE.has(entry.name)) continue;
        await walk(target);
        continue;
      }
      if (relative === "fewbie.module.json") continue;
      files.push(installTarget(name, relative));
    }
  }
  await walk(directory);
  return files;
}

/** Reject absolute or escaping paths; returns the normalized POSIX form. */
function normalizeFile(module, file) {
  if (typeof file !== "string" || file.length === 0) {
    fail(module, "files entries must be non-empty strings");
    return undefined;
  }
  if (path.isAbsolute(file)) {
    fail(module, `files entry '${file}' must be a project-relative path`);
    return undefined;
  }
  const normalized = path.posix.normalize(file);
  if (normalized === ".." || normalized.startsWith("../")) {
    fail(module, `files entry '${file}' escapes the module directory`);
    return undefined;
  }
  return normalized;
}

async function checkModule(name) {
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
    // Payload is stored at the target minus the install root (ADR-071).
    const storage = storagePath(name, normalized);
    const stat =
      storage === undefined ? undefined : await fs.lstat(path.join(directory, storage)).catch(() => undefined);
    if (storage !== undefined && stat === undefined) {
      fail(name, `files entry '${normalized}' does not exist in the module directory`);
    } else if (stat?.isSymbolicLink()) {
      fail(name, `files entry '${normalized}' must be a real file, not a symlink`);
    }
  }
  for (const duplicate of duplicates(declared)) fail(name, `files declares '${duplicate}' more than once`);
  const typeLayers = TYPE_LAYERS[manifest.type];
  if (typeLayers !== undefined) {
    for (const file of declared) {
      const segments = file.split("/");
      if (
        segments[0] !== "src" ||
        segments[1] !== "fewbie" ||
        segments[2] !== "modules" ||
        segments[3] !== name ||
        !typeLayers.includes(segments[4]) ||
        segments.length < 6
      ) {
        fail(
          name,
          `files entry '${file}' must land under src/fewbie/modules/${name}/<${typeLayers.join("|")}>/ for type '${manifest.type}' (ADR-070)`,
        );
      }
    }
  }
  comparePayload(name, declared, await payloadFiles(name, directory));

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
      fail(name, `registryDependencies lists '${dependency}', which is not a module in this registry`);
    }
  }

  const sources = await declaredSources(name, directory, declared);
  moduleSources.set(name, { declared, sources });
  checkImports(name, manifest, declared, sources);

  if (TYPE_LAYERS[manifest.type] === undefined) {
    fail(name, `type '${manifest.type}' is not one of ${Object.keys(TYPE_LAYERS).join(", ")}`);
  }

  const contract = manifest.contract;
  if (contract === undefined) {
    // A block is a host-facing vertical; without a contract its labels, ports
    // and states are unverified. Copy-only lib/component modules may skip.
    if (manifest.type === "registry:block") {
      fail(name, `${manifest.type} modules must declare a contract`);
    } else {
      warn(name, "fewbie.module.json has no contract; contract checks skipped (R79-01)");
    }
    skipped.push(name);
    return;
  }

  // Same rules the install parser applies (R87-01): a manifest this gate
  // accepts must parse in the CLI, so a version or range is judged by semver
  // instead of a prefix regex, and an empty list is not "nothing to check".
  if (typeof contract !== "object" || Array.isArray(contract)) {
    fail(name, "contract must be an object");
    skipped.push(name);
    return;
  }
  if (semver.valid(contract.version) === null) {
    fail(name, `contract.version '${contract.version}' is not semver`);
  }
  if (typeof contract.framework !== "string" || semver.validRange(contract.framework) === null) {
    fail(name, `contract.framework '${contract.framework}' is not a semver range`);
  } else if (CLI_VERSION !== undefined && !semver.satisfies(CLI_VERSION, contract.framework)) {
    fail(name, `contract.framework '${contract.framework}' excludes the shipping CLI (${CLI_VERSION})`);
  }
  const entry = normalizeFile(name, contract.entry);
  if (entry === undefined || !declared.includes(entry))
    fail(name, `contract.entry '${contract.entry}' is not an installed file`);

  for (const field of ["labels", "ports", "ui", "states"]) {
    if (!Array.isArray(contract[field])) fail(name, `contract.${field} must be an array`);
  }
  for (const field of ["labels", "states"]) {
    if (Array.isArray(contract[field]) && contract[field].length === 0) {
      fail(name, `contract.${field} must not be empty`);
    }
  }
  for (const field of ["labels", "ports", "ui", "states"]) {
    const list = Array.isArray(contract[field]) ? contract[field] : [];
    for (const value of list) {
      if (typeof value !== "string" || value.length === 0) {
        fail(name, `contract.${field} entries must be non-empty strings`);
      }
    }
    for (const repeated of duplicates(list)) fail(name, `contract.${field} repeats '${repeated}'`);
  }

  for (const port of Array.isArray(contract.ports) ? contract.ports : []) {
    if (typeof port === "string" && !PORT_METHOD.test(port)) {
      fail(name, `contract.ports '${port}' is not a method name`);
    }
  }
  for (const state of Array.isArray(contract.states) ? contract.states : []) {
    if (!ALLOWED_STATES.has(state)) fail(name, `contract.states '${state}' is not allowed`);
  }
  for (const atom of Array.isArray(contract.ui) ? contract.ui : []) {
    if (!ALLOWED_UI.has(atom)) fail(name, `contract.ui '${atom}' is not on the framework allowlist`);
  }
  // A state is a behaviour claim, not a vocabulary choice: the payload should
  // actually implement it (R82-14). Evidence is a token scan, so a miss is a
  // warning — a module may render a state through a helper this scan cannot see
  // (R87-08).
  const sourceText = sources.map((source) => source.source).join("\n");
  for (const state of Array.isArray(contract.states) ? contract.states : []) {
    const evidence = STATE_EVIDENCE[state];
    if (evidence !== undefined && !evidence.test(sourceText)) {
      warn(name, `contract.states declares '${state}' but no installed file shows its token`);
    }
  }

  const layers = contract.layers;
  if (layers !== undefined) {
    // Merged block: each layer names its own types.ts, the top-level lists are
    // the union, and a key declared by two layers would collide in the adapter
    // (ADR-069 D5).
    if (semver.major(contract.version) < 2) {
      fail(name, `contract.layers require contract.version 2.0.0 or later (got '${contract.version}')`);
    }
    if (!Array.isArray(layers) || layers.length === 0) {
      fail(name, "contract.layers must be a non-empty array");
      checked.push(name);
      return;
    }
    const seenTypes = new Set();
    for (const layer of layers) {
      if (layer === null || typeof layer !== "object" || Array.isArray(layer)) {
        fail(name, "contract.layers entries must be objects");
        continue;
      }
      const layerName = layer.layer;
      if (!LAYERS.includes(layerName)) {
        fail(name, `contract.layers[].layer '${layerName}' must be one of ${LAYERS.join(", ")}`);
        continue;
      }

      const types = normalizeFile(name, layer.types);
      if (types === undefined || !declared.includes(types)) {
        fail(name, `contract.layers.${layerName}.types '${layer.types}' is not an installed file`);
        continue;
      }
      if (!types.startsWith(`src/fewbie/modules/${name}/${layerName}/`)) {
        fail(
          name,
          `contract.layers.${layerName}.types '${types}' must land under src/fewbie/modules/${name}/${layerName}/`,
        );
        continue;
      }
      if (seenTypes.has(types)) fail(name, `contract.layers declares '${types}' more than once`);
      seenTypes.add(types);
      for (const field of ["labels", "ports", "states"]) {
        if (!Array.isArray(layer[field])) {
          fail(name, `contract.layers.${layerName}.${field} must be an array`);
          continue;
        }
        for (const value of layer[field]) {
          if (typeof value !== "string" || value.length === 0) {
            fail(name, `contract.layers.${layerName}.${field} entries must be non-empty strings`);
          }
        }
        for (const repeated of duplicates(layer[field])) {
          fail(name, `contract.layers.${layerName}.${field} repeats '${repeated}'`);
        }
      }
      // Locale defaults are copy the host may omit (ADR-074). Shape only: keys
      // must belong to this layer's labels and values must be non-empty; locale
      // coverage belongs to the host, which owns the framework language set.
      const defaults = layer.defaults;
      if (defaults !== undefined) {
        if (defaults === null || typeof defaults !== "object" || Array.isArray(defaults)) {
          fail(name, `contract.layers.${layerName}.defaults must be an object keyed by locale`);
        } else {
          const layerLabels = new Set(Array.isArray(layer.labels) ? layer.labels : []);
          for (const [locale, copy] of Object.entries(defaults)) {
            if (locale.trim() === "") {
              fail(name, `contract.layers.${layerName}.defaults has an empty locale key`);
              continue;
            }
            if (copy === null || typeof copy !== "object" || Array.isArray(copy)) {
              fail(name, `contract.layers.${layerName}.defaults.${locale} must be an object of label copy`);
              continue;
            }
            for (const [key, text] of Object.entries(copy)) {
              if (!layerLabels.has(key)) {
                fail(
                  name,
                  `contract.layers.${layerName}.defaults.${locale} key '${key}' is not one of the layer's labels`,
                );
              }
              if (typeof text !== "string" || text.trim() === "") {
                fail(name, `contract.layers.${layerName}.defaults.${locale}.${key} must be a non-empty string`);
              }
            }
          }
        }
      }
      const layerStorage = storagePath(name, types);
      const layerSource =
        layerStorage === undefined
          ? undefined
          : await fs.readFile(path.join(directory, layerStorage), "utf8").catch(() => undefined);
      if (layerSource === undefined) {
        fail(name, `contract.layers.${layerName}.types '${types}' does not exist`);
        continue;
      }
      const facts = interfaceFacts(path.join(directory, layerStorage), layerSource);
      compare(name, `layers.${layerName}.labels`, layer.labels ?? [], facts.labels);
      compare(name, `layers.${layerName}.ports`, layer.ports ?? [], facts.ports);
    }
    for (const field of ["labels", "ports", "states"]) {
      const union = [...new Set(layers.flatMap((layer) => (Array.isArray(layer?.[field]) ? layer[field] : [])))];
      if (field === "labels") {
        const repeated = duplicates(layers.flatMap((layer) => (Array.isArray(layer?.labels) ? layer.labels : [])));
        for (const key of repeated) {
          fail(name, `contract.labels key '${key}' is declared by more than one layer`);
        }
      }
      const declaredList = Array.isArray(contract[field]) ? contract[field] : [];
      const missing = union.filter((key) => !declaredList.includes(key));
      const extra = declaredList.filter((key) => !union.includes(key));
      if (missing.length > 0) fail(name, `contract.${field} is missing layer key(s) ${missing.join(", ")}`);
      if (extra.length > 0) fail(name, `contract.${field} lists ${extra.join(", ")} that no layer declares`);
    }
  } else {
    // v1 module: types.ts sits beside the entry file (ADR-070 module-first tree).
    const typesRelative = `${path.posix.dirname(entry)}/types.ts`;
    const typesStorage = storagePath(name, typesRelative);
    const typesPath = typesStorage === undefined ? undefined : path.join(directory, typesStorage);
    const typesSource =
      typesPath === undefined ? undefined : await fs.readFile(typesPath, "utf8").catch(() => undefined);
    if (typesSource === undefined) {
      fail(name, `contract is declared but '${typesRelative}' does not exist`);
      checked.push(name);
      return;
    }

    const facts = interfaceFacts(typesPath, typesSource);
    compare(name, "labels", contract.labels, facts.labels);
    compare(name, "ports", contract.ports, facts.ports);
  }

  const atoms = await collectUiAtoms(directory);
  compare(name, "ui", contract.ui, atoms);

  checked.push(name);
}

/**
 * The install order is derived from `registryDependencies`, so a cycle can
 * never be installed: the host would either loop or land the modules in an order
 * where one import has no file yet (R86-06). Detect cycles over the declared
 * graph and report the concrete loop.
 */
function checkDependencyCycles() {
  const state = new Map();
  const stack = [];
  const reported = new Set();

  function visit(name) {
    const current = state.get(name);
    if (current === "done") return;
    if (current === "visiting") {
      const at = stack.indexOf(name);
      const cycle = [...stack.slice(at), name].join(" -> ");
      if (!reported.has(cycle)) {
        reported.add(cycle);
        fail(name, `registryDependencies form a cycle: ${cycle}`);
      }
      return;
    }
    state.set(name, "visiting");
    stack.push(name);
    for (const dependency of manifests.get(name)?.registryDependencies ?? []) {
      if (manifests.has(dependency)) visit(dependency);
    }
    stack.pop();
    state.set(name, "done");
  }

  for (const name of manifests.keys()) visit(name);
}

/**
 * A declared registry dependency exists so the host installs the module that
 * provides an import. When nothing in the payload imports it, the declaration
 * only makes installs heavier; warn instead of failing so a deliberate
 * provider-only dependency stays possible (R86-06).
 */
function checkUnusedDependencies() {
  for (const [name, { sources }] of moduleSources) {
    const targets = importedTargets(sources);
    for (const dependency of manifests.get(name)?.registryDependencies ?? []) {
      const files = manifests.get(dependency)?.files ?? [];
      const used = [...targets].some((target) => aliasIsProvided(target, files));
      if (!used) warn(name, `registryDependencies lists '${dependency}' but no installed file imports it`);
    }
  }
}

const modulesRootExists = await fs
  .access(root)
  .then(() => true)
  .catch(() => false);
if (!modulesRootExists) {
  console.error(`Contract check failed: ${MODULES_DIR} is missing; run this from the registry repository root.`);
  process.exit(1);
}

const entries = await fs.readdir(root, { withFileTypes: true });
const moduleNames = [];
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) {
    continue;
  }
  const hasManifest = await fs
    .access(path.join(root, entry.name, "fewbie.module.json"))
    .then(() => true)
    .catch(() => false);
  if (hasManifest) moduleNames.push(entry.name);
}
// Parse every manifest first: import checks and registryDependencies validation
// need to see modules other than the one being checked.
for (const name of moduleNames) {
  manifests.set(name, JSON.parse(await fs.readFile(path.join(root, name, "fewbie.module.json"), "utf8")));
}
for (const name of moduleNames) await checkModule(name);

checkDependencyCycles();
checkUnusedDependencies();

if (CLI_VERSION === undefined) {
  warn(
    "registry",
    "contract.framework ranges were not checked against the shipping CLI: @devbie/fewbie-cli is not installed",
  );
}

if (warnings.length > 0) {
  console.warn(`Contract check warnings:\n  ${warnings.join("\n  ")}`);
}

if (errors.length > 0) {
  console.error(`Contract check failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✓ ${checked.length} module contract(s) match their types.ts interface: ${checked.sort().join(", ")}${
    skipped.length > 0 ? ` (${skipped.length} module(s) skipped: no contract — ${skipped.sort().join(", ")})` : ""
  }`,
);
