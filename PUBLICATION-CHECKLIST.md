# Public repository publication checklist

This directory is a sanitized source snapshot prepared for a **new repository with a fresh Git history**.

## Before publishing

- [ ] Choose and add a project license. `LICENSE-STATUS.md` records that this is still unresolved; do not claim the project is open source without a license.
- [ ] Review the source tree and examples for local hostnames, account names, addresses, keys, tokens and personal paths.
- [ ] Keep real device registries, SSH keys, `known_hosts`, secrets and local config outside Git.
- [ ] Configure the intended public Git author identity locally before the first commit.
- [ ] Create a new empty repository; do not push or copy the old `.git` directory.
- [ ] Run `npm ci`, `npm test`, `npm run lint`, and `npm run test:admin-smoke` from `02-next`.
- [ ] Review the GitHub repository owner/name and visibility settings before making it public.

## Start a fresh Git history

From this directory:

```sh
git init -b main
git add .
git status --short
# Review staged files before the first commit.
git commit -m "Initial sanitized HomeLAN source"
# Add the URL of the newly created empty repository, then push main.
```

Do not reuse an old clone or copy its `.git` directory. A new commit on top of old history does not erase data from earlier commits.

## SSH identity behavior

The Admin CLI now requires an explicit `--user` for every `device add`. No personal or machine-specific SSH username is compiled into the program. Existing local registries created before this change must be updated to include `sshUser` for each device.
