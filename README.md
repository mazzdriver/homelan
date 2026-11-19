# HomeLAN 2.1.0

HomeLAN is a parent-operated control system for household computers. Version 2.1 adds system discovery, declarative installation planning, local platform-adapter selection and an offline npm distribution.

> **2.1.0 is a supervised test build.** It has not been tested against the real household computers. Do not replace the existing installation until the staged enrollment and behavior checks pass.

## Repository layout

- `00-legacy/` — behavior inventory for the original Bash implementation. Original Bash source is not included in this recovered repository.
- `01-python/` — provenance and recovery notes for the 2026-11-16 Python CLI snapshot. The original Python engine is not included here.
- `02-next/` — active npm workspace (`@homelan/admin`, `@homelan/protocol`, `@homelan/client`) and tests.
- `03-project-history/` — decisions, discussions, backlog and changelog.
- `04-source-recovery/` — notes on recovering missing historical source artifacts.
- `release/offline/` — standalone distribution with all npm tarballs and offline installers.

## Quick development check

Requirements: Node.js 20+ and npm.

```sh
cd 02-next
npm install
npm test
npm run lint
npm run test:admin-smoke
node packages/homelan-admin/bin/homelan.js --help
```

## Architecture

```text
Admin CLI (Windows / Linux / Termux)
  ├─ local device registry
  ├─ local OS/runtime discovery
  ├─ OpenSSH transport (strict known_hosts)
  └─ JSON-lines RPC over SSH stdin/stdout
            │
            ▼
Client bootstrap (POSIX shell, before Node install)
  ├─ OS / distro / desktop / init / package manager detection
  ├─ capabilities + declarative install plan
  └─ refuse unsupported platform adapters
            │
            ▼
Client CLI (Linux/systemd operational in 2.1)
  ├─ protocol validation
  ├─ platform adapter registry
  ├─ local account/session operations
  └─ systemd + logind integration
```

JavaScript orchestrates discovery, protocol and adapter selection. Platform-specific logic ships inside the Client package. The system does not download arbitrary scripts based on a target's response. Windows is detected but its control adapter is not yet implemented.

There is no permanent TCP listener. SSH is the transport. Passwords and RPC payloads travel through SSH stdin, not command-line arguments. A device has a stable HomeLAN ID, separate from hostname, address, SSH account and managed local users.

## New discovery commands

```sh
homelan system inspect
homelan client inspect <id|all>
homelan client plan <id|all>
```

`client enroll` stages the client package, obtains its read-only system plan, refuses unsupported targets, then installs and enrolls it.

## Current command surface

```text
homelan init
homelan system inspect
homelan device add <id> --address <host> --user <ssh-user> [--port <port>] [--identity <file>] [--managed-users <csv>]
homelan device list
homelan device check <id|all>
homelan client inspect <id|all>
homelan client plan <id|all>
homelan client enroll <id>
homelan client install <id|all>
homelan client update <id|all>
homelan client status <id|all>
homelan client diagnose <id>
homelan lock <id> --user <name>
homelan locknow <id> [--user <name>]
homelan newpass <id> --user <name>
homelan autologin <id> --user <name> --enable|--disable
homelan locker <id> --user <name> --time <minutes>
homelan arm <id> --user <name> --time <minutes>
homelan poweroff <id> --confirm
```

## Offline distribution

The `release/offline/` directory contains `homelan-admin`, `homelan-client` and `homelan-protocol` tarballs plus `install-offline.ps1` and `install-offline.sh`. The package installation itself does not contact the npm registry. Node.js 20+ and npm must already be installed. Keep the offline folder available when using Admin to deploy the Client package to a target.

## Safety rules

- No automatic SSH host-key acceptance. Verify the target fingerprint out-of-band and add it to `known_hosts` before using HomeLAN.
- No real target access is performed by the test suite or build process.
- `lock` first locks the selected child's active graphical session; only after successful locking does it reset the child's password to a random one-time value. The password is shown to the parent only after every selected device succeeds.
- `newpass` is a separate parent recovery operation and resets the ARM usage window.
- `poweroff` is a standalone operation and requires `--confirm`. No other operation powers off a computer.
- No passwords are stored in configuration or passed in argv.
- Unsupported platform operations fail closed and do not attempt Linux commands.

## Release status

- System discovery and declarative planning: implemented and locally tested.
- npm packages: locally packed and independently installed from tarballs with `npm --offline`.
- Protocol, CLI/client and SSH mock tests: 31 tests passing in the development environment. Admin workstation smoke checks also pass locally; see `02-next/docs/testing-admin.md`.
- Real SSH enrollment, LightDM behavior, systemd operation and XFCE integration: **not verified on target hardware**.
- LOCKER adapter, TIMER migration, staged provisioning, hardened least-privilege installer, dedicated admin key management and Windows client adapter: pending.

This is a supervised test build, not a claim that all legacy functionality has been migrated.
