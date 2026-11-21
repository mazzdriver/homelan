# HomeLAN backlog

Status values: `accepted` = agreed requirement; `implemented` = present in 2.0 code; `partial` = some pieces exist but not ready to rely on; `planned` = desired work; `open` = design decision unresolved.

## HOM-001 — Split Admin / Client packages
Status: implemented
Separate `@homelan/admin` and `@homelan/client` npm packages, plus canonical `@homelan/protocol`. Each Admin/Client package is independently packable and installable. Protocol copies are currently vendored and parity-tested.

## HOM-002 — Protocol contract and compatibility
Status: partial
Versioned JSON-lines envelopes, request IDs, allowlisted operations, structured success/failure responses and error codes exist. Capability negotiation and a version/capability compatibility matrix are implemented and mock-tested (unreleased): Admin pings, refuses locally when incompatible, and `homelan client compat` reports the matrix. Still unvalidated against real clients, and no multi-version client fleet exists yet to exercise the matrix.

## HOM-003 — Device registry and network identity
Status: partial
Local registry separates stable ID, address, SSH username, port, identity file and managed users. DHCP reservations are documented as preferred. Discovery, address refresh and multi-admin synchronization remain.

## HOM-004 — Bootstrap / enroll over SSH
Status: partial
Strict host-key checking and SSH/SCP package enrollment exist. Bootstrap currently relies on `sudo npm install -g`; it needs a root-owned verified installer and narrower sudoers before broad deployment.

## HOM-005 — Admin SSH identity
Status: planned
Dedicated key/identity for the admin app. Design secure storage, trust enrollment, rotation, revocation and recovery.

## HOM-006 — Parent lock semantics
Status: partial
Client targets the managed user's active seat session, locks first, then resets the password; password is not changed if screen lock fails. Needs real Mint/XFCE validation and robust parent recovery tests.

## HOM-007 — Separate autologin management
Status: partial
Dedicated LightDM drop-in writes the managed user's autologin setting. Must be validated against the exact LightDM configuration on target machines.

## HOM-008 — Explicit poweroff confirmation
Status: implemented
Standalone `poweroff` operation and CLI `--confirm` guard. No other action requests shutdown.

## HOM-009 — TIMER migration
Status: planned
Move TIMER from legacy controller only after documenting exact semantics and implementing explicit confirmation for delayed poweroff.

## HOM-010 — Provisioning split
Status: partial
General OS setup is explicitly outside HomeLAN. Client package currently installs ARM systemd integration only; staged provisioning is not implemented.

## HOM-011 — Idempotent staged provisioning
Status: planned
Implement clear stages, safe re-run behavior, preflight and rollback. Preserve hostname/role validation and force semantics until explicitly redesigned.

## HOM-012 — TUI and localization
Status: planned
Design terminal UI, locale selection, translated strings and non-interactive mode parity.

## HOM-013 — Cross-platform client backends
Status: planned
Admin CLI is Node-based and portable in design. Client currently has a Linux adapter only; future Windows/macOS implementations should use native APIs.

## HOM-014 — Public repository hygiene
Status: partial
Local config and secret paths are ignored; examples avoid personal values. License is still undecided and Git history needs a complete privacy audit before public push.

## HOM-015 — Client update / rollback
Status: partial
Package update works through local npm pack or registry installation. Health-checked atomic update and rollback are not implemented.

## HOM-016 — TUI diagnostics and per-device results
Status: partial
Text CLI reports per-device outcomes and includes basic client diagnostics. Structured logs and richer diagnostics remain.

## HOM-017 — ARM / LOCKER / TIMER separation
Status: partial
ARM is implemented as a separate timer; LOCKER stores configuration but is explicitly inactive; TIMER is not migrated. Keep their semantics separate.

## HOM-018 — Legacy retirement
Status: planned
Do not delete `kid-ctl.sh`, `provision.sh` or `kid-session-tick.sh` until every function is migrated and verified. Original legacy source is not currently present in this recovered repository.

## 2.1 follow-up backlog

- [ ] Implement and validate XFCE LOCKER using reliable per-session idle detection; never infer idle thresholds from logind `IdleHint` alone.
- [ ] Recover and specify legacy TIMER semantics before porting delayed lock/logout/poweroff; require explicit confirmation for scheduling destructive actions.
- [ ] Implement hardened root-owned bootstrap/installer with least-privilege sudo policy and rollback.
- [ ] Implement Windows Client adapter (service lifecycle, interactive-session broker, lock/unlock semantics) before claiming Windows support.
- [x] Add adapter capability negotiation and version compatibility matrix for mixed client versions. (Implemented and mock-tested; validate on real clients.)
- [ ] Test on real Linux Mint 22 XFCE systems with mock-first and explicit parent approval; no target access in build/test stage.
- [~] Add cross-platform CI on Windows, Linux and Termux where practical. (Workflow for Linux/Windows/macOS added but not yet run on GitHub; Termux stays manual.)

## Engineering follow-ups (see `02-next/docs/engineering/WORK-PACKETS.md`)

- [ ] Client OS logic is ~14% covered because it cannot run without root. Introduce a system port and test it (WP-02, WP-03).
- [ ] Add CI gates: protocol-copy check, manifest check, shell syntax, coverage ratchet (WP-01).
- [ ] Fix `installUnits()` using an unimported `writeConfig` (DEF-001, WP-04).
- [ ] Per-operation parameter validation (WP-05); single version source (WP-06).
- [ ] ARM usage accounting by elapsed time instead of tick count; needs owner approval (WP-12).
- [ ] Client uninstall, audit log, `--json` output, `doctor`, `--dry-run` (WP-14 … WP-18).

