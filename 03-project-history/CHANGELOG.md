# Changelog

## 2.0.0 — 2026-11-17

- Replaced the empty npm scaffold with a working Admin / Protocol / Client workspace.
- Added a versioned JSON-lines RPC contract and strict operation allowlist.
- Added cross-platform Node Admin CLI, local device registry, strict SSH host-key checking and SCP/npm client deployment.
- Added Linux Client RPC entrypoint, enrollment metadata, status/diagnostics, password reset, targeted screen lock, LightDM autologin override, ARM active-time timer and explicit poweroff.
- Added local and mock-SSH tests plus package pack/install smoke checks.
- Explicitly marked LOCKER inactive; TIMER, hardened root bootstrap, dedicated SSH identity management, staged provisioning, update rollback and non-Linux client adapters remain pending.
- No real target devices were accessed during implementation or testing.

## 2.1.0 — 2026-11-17

- Added read-only host discovery for OS, distro, architecture, desktop, session, init system, package manager, Node.js runtime and command availability.
- Added a platform adapter registry. Linux/systemd is operational; Windows is detected and explicitly reports a pending adapter. Unsupported systems fail closed before Linux-specific operations.
- Added `homelan system inspect`, `homelan client inspect` and `homelan client plan`.
- Added a POSIX-shell pre-Node bootstrap, so targets can be inventoried before Node.js exists. Admin stages the helper, receives the declarative plan and refuses unsupported or not-ready targets.
- Added an offline distribution containing all three npm tarballs and PowerShell/shell installers. The Admin installer inspects OS/architecture/runtime first and makes no changes when prerequisites are missing; package installation does not require npm registry access.
- Expanded the suite to 25 tests, including pre-Node discovery and missing-runtime behavior. Verified independent offline installation of Admin and Client tarballs.
- Kept LOCKER and TIMER explicitly disabled/unported rather than pretending they are functional. Node.js runtime provisioning on targets is reported but still manual.


## Test infrastructure follow-up — 2026-11-19

- Expanded SSH transport coverage with cross-platform mocked-process tests for strict arguments, stdin RPC, connection errors, malformed/mismatched responses, remote failures and timeouts.
- Added `npm run test:admin-smoke` for repeatable Admin workstation checks using an isolated temporary config and synthetic TEST-NET device; it makes no network connection.
- Added a manual Admin/target acceptance checklist with explicit safety boundaries and evidence requirements.
- Added GitHub Actions CI for Node 20, issue templates for bugs/features and a pull-request checklist.
- Local verification: 31 automated tests, lint and Admin smoke checks pass. No real household client was accessed.

## Capability negotiation and test hygiene follow-up — 2026-11-19

- Added capability negotiation and a compatibility matrix (HOM-002). The protocol package exports `negotiate()`, `compatibilityMatrix()`, `compareVersions()`, `OPERATION_CAPABILITIES`, `OPERATION_MIN_VERSION`, `SUPPORTED_PROTOCOL_VERSIONS` and `MIN_CLIENT_VERSION`; the vendored Client and Admin copies stay byte-identical (enforced by a test).
- Client `ping` now reports `supportedProtocolVersions`, `adapter`, `ready` and `capabilities`; the Client dispatcher shares the capability map with Admin.
- Admin pings before every operation except `ping` and refuses locally, without transmitting the operation or any secret, when the client is too old, speaks another protocol or lacks a required capability. Pre-2.1 clients that report no capabilities are allowed and marked client-enforced.
- Added `homelan client compat <id|all>` to print each device's allowed and blocked operations.
- Fixed two environment-dependent tests that assumed `/usr/bin:/bin` contains no Node.js; one of them ran the real offline installer and installed packages globally when Node was present. Both now use a hermetic PATH built without Node/npm. POSIX-shell and Linux-only tests skip themselves on other platforms.
- CI now runs on Linux, Windows and macOS with Node 20 and 22; the Admin smoke check stays Linux-only. The Windows and macOS legs have not run on GitHub yet; Termux remains a manual check.
- Release tarballs and the offline bundle were not rebuilt and still contain the pre-negotiation 2.1.0 code.
- No real target device was accessed.

## Engineering guide and tooling — 2026-11-19

- Added `02-next/docs/engineering/` (architecture map, functional review with verified defects, test strategy with required checks, 20 work packets).
- Added `npm run sync:protocol` / `check:protocol` (single sanctioned way to update the vendored protocol copies), `npm run manifest:write` / `manifest:check`, and `npm run test:coverage`.
- Removed a no-op line from `client compat`.
- Extended `AGENTS.md` with rules for contributors working with limited context; recorded the "hardened by default" and engineering-guide decisions.
- No product behaviour changed.

