# fewbie-modules

Page-level modules for [fewbie](https://github.com/worldzhy/devbie) applications.

This repository is a fewbie module registry: the repository root **is** the
registry root, and every directory holding an `item.json` is one installable
item. A host declares it in `fewbie.json` and installs with the CLI:

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

## Items

| Item                   | Targets                               | Description                                                                     |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| `login-page`           | `src/modules/login-page/**`           | Password/code login, inline TOTP challenge, third-party providers               |
| `forgot-password`      | `src/modules/forgot-password/**`      | Email plus verification code password reset with a live strength checklist      |
| `profile-settings`     | `src/modules/profile-settings/**`     | Account profile card: names and display name, persisted by the host             |
| `security-settings`    | `src/modules/security-settings/**`    | Active sessions with per-row sign-out, and authenticator-app enrollment         |
| `preferences-settings` | `src/modules/preferences-settings/**` | Interface language, theme and timezone, with host-side cache and cookie updates |

An item directory mirrors the target layout: `login-page/src/modules/login-page/login-page.tsx`
is copied to `src/modules/login-page/login-page.tsx` in the host.

## Contracts

- Modules depend only on the fewbie framework surface (`@/components/ui/*` and
  React); they never import a host's i18n, router, transport or toast library.
- Copy, transport and side effects enter through props (`labels`, `port`,
  `onSignedIn`), so a host keeps its own i18n and API client.
- Item manifests use the authored fewbie form: `files` are project-relative
  path strings, `type` is one of `registry:lib`, `registry:component`,
  `registry:block`.
