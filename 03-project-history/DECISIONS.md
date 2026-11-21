# Architecture decisions and accepted requirements

## 2026-11-17 — Admin / Client split

Separate `homelan-admin` and `homelan-client` packages. Both are to be distributed through npm. A separate protocol package is introduced to keep the wire contract explicit. npm distribution does not force all OS-level client behavior into JavaScript.

## 2026-11-17 — Device identity and network

Keep stable device ID separate from hostname, address, SSH username, role and managed local accounts. Prefer DHCP reservations. Avoid remote network reconfiguration unless necessary because it can sever SSH. Discovery, DNS/mDNS and multi-admin config synchronization remain open design topics.

## 2026-11-17 — Lock semantics

New `homelan lock` is parental intervention: lock the screen immediately and reset the child's password by default. Preserve user data and session wherever possible; do not log out or power off as side effects. Report partial failures separately. Parent must be able to restore access. Old autologin manipulation becomes its own operation. Whether a `--keep-password` option exists is unresolved.

## 2026-11-17 — Poweroff

Poweroff is a separate explicit operation and requires confirmation. No other operation may shut down a client as a side effect. Timer + delayed poweroff confirmation semantics remain to be designed.

## 2026-11-17 — Provisioning boundary

Keep only HomeLAN-owned session/lock/timer/ARM/LOCKER/systemd configuration in HomeLAN provisioning. General machine setup (desktop packages, xrdp, ordinary user creation, etc.) is outside the project.

## 2026-11-17 — Open source

Move project to a separate public repository. Personal names, hostnames, account names, home network addresses, secrets and local values must live in ignored local configuration. Provide safe example configuration. Audit Git history before public push.

## Backlog

TUI with localization; dedicated SSH identity/key for admin application; identity enrollment, trust, rotation and recovery; cross-platform client adapters; robust update/rollback; device discovery; protocol compatibility; staged/idempotent provisioning.

## 2026-11-17 — npm 2.0 package contract

The Admin and Client packages are independently installable and currently vendor the small protocol module to avoid an unpublished inter-package dependency during first deployment. The canonical `@homelan/protocol` package remains the source of truth; automated tests compare both vendored copies against it. A future release script should generate the copies rather than maintain them manually.

## 2026-11-17 — 2.0 test-build boundary

Version `2.0.0` is a supervised test build, not a claim of full legacy parity. LOCKER is explicitly inactive, TIMER is not migrated, and target-specific LightDM/logind behavior remains unverified. No live child computer may be contacted without explicit user authorization.

## 2026-11-17 — Platform discovery and adapter selection (2.1)

- JavaScript is the orchestration, discovery and protocol layer; it does not download or execute arbitrary scripts suggested by a client.
- The client reports a structured system inventory and declarative install plan before the Admin installs the package.
- Platform-specific code ships inside the versioned Client package and is selected through a local adapter registry.
- Linux/systemd is the only operational adapter in 2.1. Windows detection is implemented, but Windows service/session control is deliberately pending.
- Unsupported platform operations return `NOT_SUPPORTED`; they must never fall through to Linux shell commands.
- The offline bundle carries Protocol, Client and Admin tarballs plus platform installers. Node.js/npm remain prerequisites; package installation itself does not contact the registry.

## 2026-11-19 — Hardened by default; training and experiments live elsewhere

The public repository contains only the hardened product. Intentionally weakened builds, exercises or answer keys for learning purposes, if any, are maintained outside this repository and must never be merged into it. Work on this repository (including by automated assistants) must not add deliberate weaknesses, and findings about security-relevant defects are fixed in the product rather than documented here as exercises.

## 2026-11-19 — Engineering guide and work packets

`02-next/docs/engineering/` is the entry point for contributors: architecture map, functional review, test strategy with required checks, and numbered work packets. Packets that change behaviour (WP-12) or add operations needing a version decision (WP-14) require owner approval before merge.

## 2026-11-20 — Operator-chosen password minimum is configurable; the default stays strict

`newpass` accepts a minimum length from 1 to 256 (default 12), set per command with `--min-length` or globally with `passwordMinLength` in the Admin config. The rule lives in the shared protocol (`validatePasswordPolicy`). Generated passwords are unaffected. Rationale: the operator manages their own household and may deliberately choose simple passwords for children's accounts; the product warns below 8 characters but does not forbid it.

