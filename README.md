# fewbie-modules

The single authored registry for [fewbie](https://github.com/worldzhy/devbie)
applications — both page-level modules and lib/component modules.

Modules live in `packages/modules/`, and every directory there holding an
`fewbie.module.json` is one installable module. A host declares the registry in
`fewbie.json` and installs with the CLI:

```json
{
  "modules": ["login-page"],
  "registry": { "url": "https://github.com/worldzhy/fewbie-modules.git", "ref": "main" }
}
```

```sh
npx fewbie modules add login-page
```

The CLI clones the declared registry into `~/.fewbie/registry/<hash>`, checks
out `ref`, and copies each module's files to their project-relative targets. Set
`FEWBIE_REGISTRY_PATH` to a local checkout to work against uncommitted changes.

This repository is the only place modules are authored. `@devbie/fewbie-cli`
ships a generated snapshot of it for hosts that declare no registry; that
snapshot is regenerated, never hand-edited (ADR-058 in `devbie`).

## Modules

| Module                 | Targets                                      | Description                                                                                                   |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `account-access`       | `src/fewbie/modules/account-access/**`       | Login page, password reset and the `auth` plus password-policy libs                                           |
| `account-settings`     | `src/fewbie/modules/account-settings/**`     | Profile, security and preferences settings features                                                           |
| `copilot`              | `src/fewbie/modules/copilot/**`              | Resizable chat dock with tool cards, confirmations and result blocks; transport and page scope are host ports |
| `data-table`           | `src/fewbie/modules/data-table/**`           | Generic data table with client-side sorting and pagination                                                    |
| `frontend-monitor-sdk` | `src/fewbie/modules/frontend-monitor-sdk/**` | Browser-side monitoring component for the root layout                                                         |
| `notification-center`  | `src/fewbie/modules/notification-center/**`  | Header bell and unread ticker plus detail sheet/panel; data, copy and categories are host ports               |
| `sse-stream`           | `src/fewbie/modules/sse-stream/**`           | SSE frame decoder; the request and auth stay in the host                                                      |
| `theme`                | `src/fewbie/modules/theme/**`                | next-themes provider and light/dark toggle                                                                    |

A module directory mirrors the target layout:
`packages/modules/account-access/src/fewbie/modules/account-access/features/login-page/login-page.tsx`
is copied to `src/fewbie/modules/account-access/features/login-page/login-page.tsx` in the host (ADR-070).

## Registry layout

Only `fewbie.module.json` and the files it declares are installed. Everything else is
registry infrastructure and never reaches a host:

| Path                                                | Role                                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/modules/<module>/fewbie.module.json`      | Manifest: `name`, `type`, `files`, optional `contract`                                                     |
| `packages/modules/<module>/<file>`                  | Payload, mirroring the host target path in `files`                                                         |
| `packages/modules/<module>/test/`                   | Conformance tests for that module                                                                          |
| `harness/framework/`                                | Host-surface doubles: `@/components/ui/*` and `@/lib/{utils,api-client}`, used by `check:types` and vitest |
| `harness/testing/`                                  | Repository-private vitest bootstrap and test utilities, imported as `@testing/*`                           |
| `scripts/`                                          | `check-contract.mjs`                                                                                       |
| `package.json`, `vitest.config.ts`, `tsconfig.json` | Tooling for this repository                                                                                |

`check-contract.mjs` enforces the structural invariants on every module:
directory name equals `fewbie.module.json.name`, every `files` entry is a safe
repository-relative path that exists under the module directory, and the on-disk
payload (excluding `test/`) matches `files` exactly. It also fails on a
`registryDependencies` cycle (the install order can never be built) and warns
when a declared registry dependency is not imported by any installed file.

## Contracts

- `registry:block` modules carry a `contract` in `fewbie.module.json`:
  `version`, `framework`, `entry`, `layers`. Each layer declares its `types.ts`
  path, `labels`, `ports`, `ui` and `states`; `types.ts` is the type truth, the
  contract is its executable projection, and `check-contract.mjs` asserts they
  agree (ADR-057, ADR-069).
- A block may span `features`, `widgets`, `components` and `lib`; the layer of a
  file (`src/fewbie/modules/<module>/<layer>/`) drives the host's import
  direction lint. features never import widgets; components and lib never import
  features or widgets.
- `registry:component` and `registry:lib` modules may omit the contract; they
  still pass the structural checks and only skip the contract comparison.
- Business vocabulary stays out of modules: notification keys, categories, skill
  catalogs and route labels arrive through props (`resolveMeta`,
  `categoryVisuals`, `pageContext`, `renderChart`), while navigation is
  delegated to `onNavigate`/`onOpenLink` callbacks.
- Modules depend only on the fewbie framework surface (`@/fewbie/ui/*`, the
  allowlisted `@/fewbie/framework/*` chrome, and React); they never import a
  host's i18n, router, transport or toast library. The framework allowlist is a
  reviewed list in `check-contract.mjs`, and the coupling is version-gated by
  `contract.framework`, so a host that has not pulled that framework release
  fails at install time instead of at build time.
- Copy, transport and side effects enter through props (`labels`, `port`,
  `onSignedIn`), so a host keeps its own i18n and API client.
- A layer may declare `defaults` — locale-keyed copy for labels the host may
  omit (`{ "en": { "email": "Email" }, "zh": { "email": "邮箱" } }`). Only
  mechanism copy belongs there: aria labels, validation errors, buttons, error
  codes and neutral hints. Product voice (page titles, descriptions, result
  promises, reassurance) stays host-owned. `check-contract.mjs` validates the
  shape only (keys belong to the layer's labels, values non-empty); locale
  coverage is enforced by the host's `fewbie modules adapters --check`, because
  the framework message files own the language set (ADR-074).
- Module manifests use the authored fewbie form: `files` are project-relative
  path strings, `type` is one of `registry:lib`, `registry:component`,
  `registry:block`.

## Gates

```sh
npm test               # module conformance tests
npm run check:contract # structural invariants + contract/types.ts parity
npm run format:check   # prettier
```

## Test coverage

Every module that renders host-facing UI has a conformance suite under
`packages/modules/<module>/test/`. Copy-only modules whose behaviour belongs to a
package they delegate to are exempt, and the reason stays here:

| Module                  | Reason                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `account-access` (auth) | Thin wrapper over `@/lib/api-client`; the request/session gate is framework-owned and tested in the starter.             |
| `frontend-monitor-sdk`  | Scaffolds a client component around `@devbie/frontend-monitor-sdk`; the SDK owns the monitoring behaviour and its tests. |
