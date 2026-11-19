# CLI reference

## Local setup and registry

- `homelan system inspect` — report the administrator machine OS, architecture, runtime, desktop and available tools.
- `homelan init` — create `~/.homelan/config.json` if absent.
- `homelan device add <id> --address <host> --user <ssh-user> [--port <port>] [--identity <file>] [--managed-users <csv>]` — add a device. No connection is made.
- `homelan device list` — print configured devices.
- `homelan device remove <id>` — remove a device from the local registry; does not alter the target.
- `homelan device check <id|all>` — make a simple SSH check with strict host-key verification.

## Client lifecycle

- `homelan client enroll <id>` — deploy the local client package, write device identity and managed users, install HomeLAN systemd integration.
- `homelan client install <id|all>` — deploy the package and install integration without writing enrollment metadata.
- `homelan client update <id|all>` — replace the client package. Local workspace package is used when available; otherwise npm registry version 2.1.0.
- `homelan client inspect <id|all>` — stage the Client package and run the read-only pre-Node bootstrap to collect a system report before installation (OS, distro, desktop, init, package manager, runtime and capabilities).
- `homelan client plan <id|all>` — return the declarative installation plan selected for each target.
- `homelan client compat <id|all>` — ask each client what it can do (`ping`) and print which protocol operations Admin may send and which are blocked, with reasons. Every other client operation runs the same check first and is refused locally, without sending it, when the client is too old, speaks another protocol, or lacks a required capability.
- `homelan client status <id|all>` — query client version, identity, active session and unit state.
- `homelan client diagnose <id>` — check platform discovery, root, systemd, logind and client config; desktop lock tooling is reported as optional.

## Session and credentials

- `homelan lock <id> --user <name>` — lock that user's active local graphical session, then reset their password to a random one-time secret. It does not log out or power off. The secret is shown only after every target succeeds.
- `homelan locknow <id> [--user <name>]` — lock the named user's session, or all active local seat sessions if `--user` is omitted. No password or timer state is changed.
- `homelan newpass <id> --user <name>` — prompt for a new password without echo; resets ARM usage and expiry state. Piped stdin is also supported.
- `homelan autologin <id> --user <name> --enable|--disable` — set or clear the HomeLAN-owned LightDM autologin override. Enabling is refused while ARM expiry or a parent-lock marker exists; it does not unlock an existing session.

## Time controls

- `homelan arm <id> --user <name> --time <minutes>` — set the active-time allowance; `0` disables the allowance. ARM is enabled by the Client systemd timer.
- `homelan locker <id> --user <name> --time <minutes>` — stores the requested idle threshold. **Not active in 2.1.0**; response explicitly reports `enabled: false`.

## Shutdown

- `homelan poweroff <id> --confirm` — explicitly request shutdown. Without `--confirm`, the command refuses. There is no automatic poweroff from lock, ARM or any other operation.

## Options and secret handling

Device IDs are stable logical IDs; use `all` only where supported. Passwords are never accepted as CLI options and never passed in argv. SSH is non-interactive and requires preconfigured host trust and authentication.
