# HomeLAN 2.1 architecture

## Components

### Admin — `@homelan/admin`

Runs on the administrator's computer. Owns CLI parsing, the local device registry (`~/.homelan/config.json`), SSH invocation, package transfer and per-device reporting. It uses the operating system's OpenSSH client and does not run a network server.

### Protocol — `@homelan/protocol`

Defines the `homelan.rpc` JSON-lines envelope, protocol version, operation allowlist and response/error structure. Admin and Client currently carry local copies of the small protocol module so each npm package is independently installable. Tests compare both copies against the canonical Protocol package. A future build/release step should generate these copies automatically.

### Client — `@homelan/client`

Runs on the managed machine. Admin invokes `sudo -n homelan-client rpc --stdio` for one request. The process reads one JSON request per line and writes one JSON response per line. It does not listen on a TCP port.

System discovery lives in `src/system.js`; it reports OS, distribution, architecture, desktop environment, session type, init system, package manager, runtime and available commands. `src/adapters/index.js` selects a platform adapter. Linux/systemd is the only operational adapter in 2.1. Windows is detected and gets an explicit pending plan; it never falls through to Linux commands. Platform-specific operations live in `src/linux.js`.

## Discovery and installation planning

Before installation, the Admin stages the client package in a temporary directory and runs its read-only POSIX shell bootstrap. This works even when Node.js is not installed yet. The bootstrap returns a structured system report and declarative install plan. Admin proceeds only when the selected adapter reports support. No scripts are downloaded from the target or executed from an arbitrary server response: adapter code ships inside the signed-off npm package. This makes JavaScript the orchestrator and platform detection layer, not a mechanism for executing arbitrary remote code.

The same discovery report is available through `homelan system inspect` locally and `homelan client inspect <id>` remotely. `homelan client plan <id>` shows the selected installation plan.

## Identity and network

A device ID is a stable logical identity. It is not a hostname, IP address, SSH username or local child account. The enrolled `managedUsers` list is an explicit allowlist; Client rejects system accounts with UID below 1000. DHCP reservations are preferred; HomeLAN does not reconfigure network interfaces remotely. The registry is local to one admin installation in 2.1; multi-admin synchronization and discovery remain open.

## Trust

Admin uses `StrictHostKeyChecking=yes` and `BatchMode=yes`. The administrator must verify and add each host key to OpenSSH `known_hosts` out-of-band. The client does not silently choose an administrator; SSH public-key authorization on the target defines who can invoke the client. Dedicated HomeLAN SSH identity provisioning, rotation and revocation are not yet implemented.

## Lock behavior

- `locknow` asks logind to lock the selected active local graphical session(s). It does not change credentials or counters.
- `lock` targets the named user's active seat session, locks it first, then changes that user's password to a random secret. If the screen lock fails, the password is not changed. If the password change fails after locking, the result reports a partial failure.
- `newpass` is a parent recovery operation. It sets a supplied password and clears the user's `.use`, `.expired` and `.parent-locked` state. Autologin cannot be enabled while ARM expiry or a parent lock marker is present.
- `autologin` only changes the HomeLAN-owned LightDM drop-in; it does not clear ARM state or unlock an already locked session.

## ARM / LOCKER / TIMER

ARM installs a one-minute systemd timer, enabled only while at least one user has a positive limit. It increments per-user active time only when logind reports an active, local graphical session that is not idle or locked. It counts only when logind explicitly reports `IdleHint=no` and `LockedHint=no`; missing/unknown hints fail closed and do not accumulate time. At expiry it verifies the session's `LockedHint=yes` after requesting a lock, then resets the password to an unknown random value and writes `.expired`. This implementation still needs validation against the exact Mint/XFCE/logind behavior on the target.

LOCKER currently stores the requested threshold but is explicitly reported as **not active**. The XFCE/light-locker idle-threshold adapter is not ported.

TIMER (delayed one-shot lock/logout/poweroff) is not migrated in 2.1. Poweroff is only available as a separate explicit command.

## Provisioning boundary

The Client package installs only HomeLAN-owned integration (currently ARM systemd units and state/config directories). General machine setup — desktop packages, xrdp, ordinary user creation, Wi-Fi and network configuration — remains outside HomeLAN.
