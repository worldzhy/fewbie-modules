# Agent instructions

## Project

fewbie module registry: a page-level module store for fewbie hosts. The
repository root is the registry root; each item directory carries `item.json`
and the source files it ships, laid out to mirror the host target path.

## Item admission criteria

A directory belongs here only when all of these hold:

- It contains no host business vocabulary: no product name, entity, status or
  enum of a specific host; copy arrives through `labels` props.
- It depends only on the fewbie framework surface (`@/components/ui/*`, React).
  No host i18n, router, transport, toast, or state library imports.
- It is copy-assemblable: the host renders the exported component with props
  and adds no hand-written adapter beyond the ports the item documents.
- Item files mirror their target path (`login-page/src/modules/login-page/*`
  lands at `src/modules/login-page/*`), so the CLI copies them verbatim.

## Workflow conventions

- Branch: `dev`; `main` is the ref hosts pin, so merge `dev` -> `main` only
  when an item is ready to install.
- Never edit an installed copy in a host; change the item here and reinstall.
- `npm run format:check` does not exist in this repository; format with the
  devbie prettier config (2 spaces, double quotes, semicolons, 120 columns).
- This repository publishes no npm packages. Hosts consume it through
  `fewbie.json`'s `registry` declaration.
