# HomeLAN 2.1 — npm workspace

Node.js 20+ is required on administrator and managed Linux client devices. The workspace contains three packages:

- `@homelan/admin` — cross-platform CLI, local device registry, strict SSH transport and package deployment.
- `@homelan/protocol` — versioned JSON-lines RPC contract.
- `@homelan/client` — Linux client RPC endpoint and system integration.

## Development

```sh
npm install
npm test
npm run lint
npm run test:admin-smoke
node packages/homelan-admin/bin/homelan.js --help
```

## First installation

1. Install Node.js 20+ and OpenSSH on the administrator device.
2. Ensure each target has Node.js 20+, npm, OpenSSH server, sudo, systemd and a working SSH account.
3. Install an SSH public key for the administrator account. The current bootstrap requires non-interactive sudo for `npm install -g` and the HomeLAN Client command. This is substantial root-level trust, not yet a hardened least-privilege installer; see `docs/security.md`.
4. Verify the target host key out-of-band and add it to the administrator's `known_hosts`. HomeLAN uses `StrictHostKeyChecking=yes`; it never accepts unknown keys automatically.
5. Run `homelan init`, then `homelan device add <id> --address <host> --user <ssh-user> --managed-users <csv>`.
6. Run `homelan system inspect` to inspect the admin machine. Run `homelan client inspect <id>` and `homelan client plan <id>` for a target. `homelan client enroll <id>` stages the Client package, performs read-only target discovery before installation, refuses unsupported adapters, then installs the package, writes device identity and managed-user list, and installs HomeLAN systemd integration.

`client install` installs the client package and ARM unit files without writing enrollment metadata; the ARM timer stays disabled until a positive `arm` limit is configured. `client update` updates the package from the local workspace archive. Managed users must already exist locally and have UID 1000 or higher.

## Security boundaries

- SSH host-key verification is strict; no `ssh-keyscan` auto-trust is performed.
- RPC requests, including password changes, are sent over SSH stdin. Secrets are never put in argv or logs.
- The client RPC process is launched by `sudo -n`; it is not a persistent daemon or listening network service.
- `poweroff` is a separate command and requires `--confirm`.
- `lock` generates a one-time random password, attempts screen lock first, and only resets the managed user's password if screen locking succeeded. The password is displayed only after all selected devices report full success.
- Client-side commands validate usernames against the enrolled `managedUsers` allowlist, reject system UIDs below 1000, and never execute arbitrary shell commands from RPC.

## Current Linux implementation notes

The RPC contract, SSH transport, enrollment, package deployment, status/diagnostics, password reset, immediate lock, parent lock, autologin drop-in, and explicit poweroff path are implemented. ARM has systemd unit files and active graphical-session accounting based on logind hints. The timer is enabled when at least one positive ARM limit is configured. It increments in 60-second ticks, locks the session, resets the password and writes expiry state at the limit.

**Known limitation:** the per-user XFCE/light-locker idle threshold adapter for LOCKER is not yet ported. The setting is stored, but the tick intentionally makes no changes and reports that it is not active. Do not rely on HomeLAN 2.1 LOCKER until this adapter is completed. `autologin` also needs validation against the exact LightDM configuration on the target before production use. No live target has been tested from this build.

## System discovery and platform adapters

Before Node.js is installed, Admin stages a tiny read-only POSIX shell bootstrap shipped with Client and collects the target report over SSH. The Client then detects OS, distribution, architecture, desktop environment, session type, init system, package manager, Node.js runtime and selected system commands. It returns facts plus capabilities and a declarative install plan. Admin uses this report before choosing the installation path. The client package contains the adapter implementation; the admin does not download or execute arbitrary scripts suggested by a target. Linux/systemd is the only operational adapter in 2.1. Windows is detected but reports a pending adapter and is not installed.

The administrator machine is inspected separately with `homelan system inspect`; it can be Windows, Linux or another Node.js host without requiring a Linux shell.

## Publishing to npm

The packages have no npm runtime dependencies on one another; the small protocol module is vendored in Admin and Client and checked against the canonical Protocol package by tests. Publish `@homelan/protocol` as the canonical reference package, then Admin and Client in any order. The development bootstrap uses `npm pack` on the local client workspace; a standalone bundle carries all three package tarballs for offline installation.

## Testing

See [`docs/testing.md`](docs/testing.md) for automated coverage and [`docs/testing-admin.md`](docs/testing-admin.md) for the Admin workstation and staged manual acceptance checklist. The local smoke test uses a temporary config and a synthetic device; it does not contact real targets.
