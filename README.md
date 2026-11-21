# fewbie-modules

The single authored registry for [fewbie](https://github.com/worldzhy/devbie)
applications — both page-level modules and lib/component items.

Items live in `packages/modules/`, and every directory there holding an
`fewbie.module.json` is one installable item. A host declares the registry in
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
out `ref`, and copies each item's files to their project-relative targets. Set
`FEWBIE_REGISTRY_PATH` to a local checkout to work against uncommitted changes.

This repository is the only place items are authored. `@devbie/fewbie-cli`
ships a generated snapshot of it for hosts that declare no registry; that
snapshot is regenerated, never hand-edited (ADR-058 in `devbie`).

## Items

| Item                      | Targets                                                                | Description                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `login-page`              | `src/features/login-page/**`                                           | Password/code login, inline TOTP challenge, third-party providers                                             |
| `forgot-password`         | `src/features/forgot-password/**`                                      | Email plus verification code password reset with a live strength checklist                                    |
| `profile-settings`        | `src/features/profile-settings/**`                                     | Account profile card: names and display name, persisted by the host                                           |
| `security-settings`       | `src/features/security-settings/**`                                    | Active sessions with per-row sign-out, and authenticator-app enrollment                                       |
| `preferences-settings`    | `src/features/preferences-settings/**`                                 | Interface language, theme and timezone, with host-side cache and cookie updates                               |
| `auth`                    | `src/lib/auth.ts`                                                      | Login/logout helpers and session-expired redirect binding                                                     |
| `data-table`              | `src/components/data-table.tsx`                                        | Generic data table with client-side sorting and pagination                                                    |
| `frontend-monitor-sdk`    | `src/components/frontend-monitor.tsx`                                  | Browser-side monitoring component for the root layout                                                         |
| `login-form`              | `src/features/login-form/**`                                           | Password login card built on the `auth` util                                                                  |
| `password-checklist`      | `src/features/password-checklist/**`                                   | Live password rule checklist with a reusable predicate                                                        |
| `notification-center`     | `src/components/notification-center/**`                                | Header bell and unread ticker plus detail sheet/panel; data, copy and categories are host ports               |
| `copilot`                 | `src/components/copilot/**`                                            | Resizable chat dock with tool cards, confirmations and result blocks; transport and page scope are host ports |
| `query-client`            | `src/lib/query-client.ts`, `src/components/query-provider.tsx`         | TanStack Query client with App Router wiring                                                                  |
| `settings-required-state` | `src/features/settings-required-state/**`                              | Empty state for missing required configuration                                                                |
| `sse-stream`              | `src/lib/sse-stream.ts`                                                | POST-based Server-Sent Events transport                                                                       |
| `theme`                   | `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx` | next-themes provider and light/dark toggle                                                                    |

An item directory mirrors the target layout:
`packages/modules/login-page/src/features/login-page/login-page.tsx` is copied to
`src/features/login-page/login-page.tsx` in the host.

## Registry layout

Only `fewbie.module.json` and the files it declares are installed. Everything else is
registry infrastructure and never reaches a host:

| Path                                                | Role                                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/modules/<item>/fewbie.module.json`        | Manifest: `name`, `type`, `files`, optional `contract`                                                     |
| `packages/modules/<item>/<file>`                    | Payload, mirroring the host target path in `files`                                                         |
| `packages/modules/<item>/test/`                     | Conformance tests for that item                                                                            |
| `harness/framework/`                                | Host-surface doubles: `@/components/ui/*` and `@/lib/{utils,api-client}`, used by `check:types` and vitest |
| `harness/testing/`                                  | Repository-private vitest bootstrap and test utilities, imported as `@testing/*`                           |
| `scripts/`                                          | `check-contract.mjs`                                                                                       |
| `package.json`, `vitest.config.ts`, `tsconfig.json` | Tooling for this repository                                                                                |

`check-contract.mjs` enforces the structural invariants on every item:
directory name equals `fewbie.module.json.name`, every `files` entry is a safe
repository-relative path that exists under the item directory, and the on-disk
payload (excluding `test/`) matches `files` exactly.

## Contracts

- Page-level modules (`registry:block` under `src/features/**`) carry a
  `contract` in `fewbie.module.json`: `version`, `framework`, `entry`, `labels`,
  `ports`, `ui`, `states`. `types.ts` is the type truth, the contract is its
  executable projection, and `check-contract.mjs` asserts they agree.
- Component-level items (`registry:component` under `src/components/**`) may
  declare the same `contract`; their `types.ts` lives next to the component
  (`src/components/<name>/types.ts`). A component without a contract still
  passes the structural checks and only skips the contract comparison
  (ADR-063).
- Business vocabulary stays out of items: notification keys, categories, skill
  catalogs and route labels arrive through props (`resolveMeta`,
  `categoryVisuals`, `pageContext`, `renderChart`), while navigation is
  delegated to `onNavigate`/`onOpenLink` callbacks.
- Modules depend only on the fewbie framework surface (`@/components/ui/*` and
  React); they never import a host's i18n, router, transport or toast library.
- Copy, transport and side effects enter through props (`labels`, `port`,
  `onSignedIn`), so a host keeps its own i18n and API client.
- Item manifests use the authored fewbie form: `files` are project-relative
  path strings, `type` is one of `registry:lib`, `registry:component`,
  `registry:block`.

## Gates

```sh
npm test               # item conformance tests
npm run check:contract # structural invariants + contract/types.ts parity
npm run format:check   # prettier
```
