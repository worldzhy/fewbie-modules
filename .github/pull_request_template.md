## Summary

## Design review

- [ ] This change introduces no new cross-host contract, renamed concept, or architecture decision, OR an ADR is linked below and was accepted before this PR was opened.
  - ADR:
- [ ] Contract changes (`fewbie.module.json` `contract`) bump `contract.version` and keep `types.ts` as the source of truth.

## Item admission

- [ ] New or changed items carry no host business vocabulary, no host runtime import (e.g. `next/*`), and no import outside the fewbie framework surface.
- [ ] The payload stays copy-assemblable: adding the item plus its declared `dependencies` / `registryDependencies` is enough, with no handwritten host adapter.

## Gate evidence

- [ ] `npm run check:contract` passes and its summary reports the real number of contract-checked items.
- [ ] `npm run check:types` passes.
- [ ] `npm test` passes, including a behaviour test for any logic or transport change.
- [ ] `npm run format:check` passes.

## Security review

- [ ] No raw credentials (tokens, passwords, full request/response bodies) are written to logs, audit records, or error messages by this change.

## Release impact

- [ ] This repository publishes no npm packages. `devbie/packages/fewbie-cli/registry/` is regenerated from `main` at release time; no manual snapshot edit is included here.

## Coordination

- [ ] Checked `git log` / `git status` for other in-flight work on the same item before starting this change.
- [ ] Staged explicit paths only (never `git add -A`) and reviewed `git diff --cached --name-status` before committing.
