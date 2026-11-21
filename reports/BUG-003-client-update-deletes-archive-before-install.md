# BUG-003: `client install/update/enroll` deletes the staged tarball before installing it

## Summary

When a local/archive client package is staged, `deploy()` removes `/tmp/<archive-name>` at the end of the read-only bootstrap step. The very next command is `sudo npm install -g /tmp/<archive-name>`, so the install always fails with `ENOENT`. Both Linux/systemd targets are affected; no version was actually updated.

## Evidence

In `02-next/packages/homelan-admin/src/commands.js` (and the installed 2.1.0 copy), `deploy()` builds:

```
bootstrap = mkdir -p /tmp/homelan-bootstrap && tar -xzf /tmp/${name} -C /tmp/homelan-bootstrap \
            && sh /tmp/homelan-bootstrap/package/bootstrap/linux.sh; rc=$?; \
            rm -rf /tmp/homelan-bootstrap /tmp/${name}; exit $rc
install   = sudo npm install -g /tmp/${name}
```

The `${name}` is deleted by `bootstrap` before `install` runs. Observed on both targets:

```
npm error code ENOENT
npm error path /tmp/homelan-client-2.1.0.tgz
```

The trailing cleanup in the outer `remote` string tries to remove the same path again, which is redundant.

## Impact

`homelan client install`, `client update` and `client enroll` cannot install a locally staged or archived client at all. The discovery plan prints successfully, which makes the failure look like an npm problem rather than an admin-side bug.

## Suggested fix

Do not remove `/tmp/${name}` in the bootstrap step; remove only `/tmp/homelan-bootstrap`. Keep the final cleanup after the install succeeds. Add an admin smoke test that stages a fake tarball and asserts the install command receives a file that still exists.
