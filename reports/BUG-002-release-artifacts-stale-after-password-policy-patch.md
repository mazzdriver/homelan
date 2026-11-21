# BUG-002: Release tarballs were not rebuilt after the password-policy patch

## Summary

Commit `906a76e` ("feat(newpass): configurable minimum password length") changes `02-next` sources and `MANIFEST.sha256`, but the tarballs under `release/npm/` and `release/offline/packages/` are still dated earlier and contain the pre-patch client.

## Evidence

- `release/npm/homelan-client-2.1.0.tgz` has no `validatePasswordPolicy` / `minLength` in `package/src/linux.js`.
- `homelan client update` resolves the client archive from the local workspace or `release/` paths. If no fresh local archive is provided, the stale released tarball (or the published npm package) is installed instead of the patched source.

## Impact

An operator who patches the source and runs a normal update can silently receive a client without the fix. No version bump or checksum refresh accompanied the source change.

## Suggested fix

Rebuild all three release tarballs from `02-next`, refresh SHA256SUMS/MANIFEST, and bump the patch version so deployed clients can be distinguished. Consider failing `client update` when the packed source version does not match the requested release version.
