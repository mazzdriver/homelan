# Discussion record (curated)

This file preserves the durable decisions and technical discussion outcomes. It is a curated summary, not a verbatim chat transcript.

## 2026-11-14 — Script packaging and architecture
- Discussed breaking the Bash monolith into clearer layers and adding README plus separate agent guidance.
- Agreed that maintainability and debugging benefit from explicit boundaries.
- Discussed a shared engine rather than duplicating command logic across shells.

## 2026-11-16 — Unified Python CLI
- Chose `homelan_core.py` as shared engine with thin Bash, PowerShell and CMD entrypoints.
- Seven commands moved into the Python engine: `newpass`, `lock`, `autologin`, `locknow`, `locker`, `arm`, `status`.
- `timer` and `probe` remained legacy.
- Python 3.10+ and OpenSSH required on admin device, not on Linux clients.
- Local tests used mock SSH; no real child device access.
- User asked about npm local `.tgz` installation and `bin` shims; npm was considered as local distribution, without requiring a remote registry.

## 2026-11-17 — Two npm packages
- User proposed `homelan-admin` and `homelan-client`, with separate network/device initialization.
- Clarified that Client must also be npm-distributed to support future platforms beyond Unix.
- Accepted three conceptual layers: Admin, Protocol, Client.
- npm is packaging/distribution; platform-specific implementation may remain native.

## 2026-11-17 — Requirements change
- `lock` redefined as parental intervention: screen lock + password reset by default, no data loss and no shutdown.
- Legacy autologin behavior must become separate command.
- Provisioning narrowed to HomeLAN-specific functionality.
- Public repository requires local configuration and secrets out of Git.
- TUI localization and dedicated admin SSH key added to backlog.
- Poweroff must be a separate explicit confirmed action.

## Safety / operational boundary
No real SSH actions to target devices without separate explicit user authorization. This restriction applies even to read-only status and diagnostics.
