# BUG-001: `client compat` documented and implemented in source, absent from released Admin package

## Summary

`homelan client compat <id|all>` is described in `02-next/docs/cli-reference.md` and implemented in `02-next/packages/homelan-admin/src/commands.js`, but it is missing from the shipped `homelan-admin-2.1.0.tgz` and therefore from the globally installed CLI (`homelan --help` does not list it; running it fails as an unknown command).

## Evidence

- Source: `02-next/packages/homelan-admin/src/commands.js` contains a `sub==='compat'` branch and imports `compatibilityMatrix`.
- Docs: `02-next/docs/cli-reference.md`, "Client lifecycle", documents `client compat`.
- Released artifact: `tar -xOf release/npm/homelan-admin-2.1.0.tgz package/src/commands.js` contains no `compat` string.
- Installed CLI: `homelan --help` omits `client compat`.

## Impact

Operators following the current documentation cannot run the advertised compatibility preflight. Documentation and released binary disagree.

## Suggested fix

Rebuild Admin 2.1.0 artifacts from the current `02-next` source, add a release smoke check that compares documented CLI commands with `homelan --help` output, and refresh release checksums.
