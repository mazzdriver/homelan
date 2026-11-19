# HomeLAN release artifacts

## 2.1.0 (current supervised test build)

- `npm/homelan-admin-2.1.0.tgz` — Admin CLI package.
- `npm/homelan-client-2.1.0.tgz` — Linux-first Client package, including a pre-Node read-only bootstrap helper.
- `npm/homelan-protocol-2.1.0.tgz` — canonical protocol reference package.
- `npm/SHA256SUMS-2.1.0` — checksums for the 2.1.0 tarballs.
- `offline/` — standalone distribution with all three packages and PowerShell/shell installers.

The offline installer requires Node.js 20+ and npm already present on the administrator device. Target-side bootstrap can inventory a Linux machine before Node is present, but 2.1 does not automatically provision Node.js; it reports this prerequisite and stops safely.

Older build archives are intentionally not included in this public source tree. Historical implementation notes remain in `03-project-history/CHANGELOG.md`.
