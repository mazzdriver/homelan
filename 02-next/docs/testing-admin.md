# Admin workstation test plan

This plan is for the computer where `@homelan/admin` is installed. It separates checks that are safe to repeat from operations that touch a real client.

## 1. Local checks — no network and no client changes

Requirements: Node.js 20+, npm, and a checkout or offline package bundle.

From `02-next/`:

```sh
npm ci
npm test
npm run lint
npm run test:admin-smoke
```

`test:admin-smoke` runs the Admin CLI against a temporary, isolated `HOMELAN_HOME`. It checks help, local system discovery, config initialization, a synthetic device registry entry, and the poweroff confirmation guard. It does **not** contact any device.

For a package-level check:

```sh
npm pack ./packages/homelan-admin
npm pack ./packages/homelan-client
```

To verify the offline bundle, unpack it to a temporary directory and run its installer only on a disposable test account/machine first. The installer preflight must stop before changing anything if Node.js 20+ or npm is missing.

## 2. SSH checks — explicitly opt in

Before any network check:

1. Confirm the device ID, address, SSH username, port and identity file in the Admin registry.
2. Verify the SSH host-key fingerprint out-of-band and add it to `known_hosts` yourself.
3. Confirm the target is powered on and reachable over the expected network.
4. Start with the read-only connectivity check:

```sh
homelan device check example-device-a
homelan device check example-device-b
```

This runs SSH `true`; it does not install HomeLAN or change client state. It does make a real network connection.

Only after that, run read-only discovery one device at a time:

```sh
homelan client inspect example-device-a
homelan client plan example-device-a
homelan client status example-device-a
homelan client diagnose example-device-a
```

Important: `inspect`/`plan` currently stage a temporary bootstrap/package on the target under `/tmp` and remove it afterward. They do not install the client, but they are not strictly read-only at the filesystem level. `status` and `diagnose` require an enrolled/installed client and execute remote diagnostic commands.

Do not use `all` for the first pass. Capture the full output and inspect every plan step before enrollment.

## 3. Staged enrollment and operation checks

Only after discovery is understood and a backup/recovery path exists:

1. Install/enroll one test client first.
2. Verify `homelan client status <id>` and `homelan client diagnose <id>`.
3. Test `locknow` with a parent/admin session available locally to recover if the desktop lock integration behaves unexpectedly.
4. Test `newpass` only with the parent present and a verified recovery procedure.
5. Test `lock` only after `locknow` and `newpass` have been independently verified.
6. Test ARM with a very short limit on a non-critical test account, watching the journal and state files.
7. Do not test `poweroff` on a child's daily-use machine. Use a disposable VM or spare machine.

`locker` is not implemented in 2.1.0; it must report that limitation and must not be treated as an active idle-lock policy. TIMER is not in the 2.1.0 command surface.

## 4. Manual regression checklist

- [ ] `homelan --help` exits successfully and lists only supported commands.
- [ ] `homelan system inspect` returns parseable JSON and does not access targets.
- [ ] `homelan device add` validates ID, address, port, SSH user and managed-user names.
- [ ] `homelan device list` does not reveal secrets (there should be none in the registry).
- [ ] Unknown device IDs fail before SSH is started.
- [ ] SSH uses `BatchMode=yes` and `StrictHostKeyChecking=yes`.
- [ ] A changed/unknown host key is rejected; HomeLAN does not auto-accept it.
- [ ] SSH secrets and RPC payloads are sent through stdin, never argv or logs.
- [ ] Malformed RPC output, mismatched request IDs, non-zero remote exit and timeout are reported as failures.
- [ ] Unsupported platform/capability requests fail closed.
- [ ] `poweroff` without `--confirm` is rejected before any remote connection.
- [ ] No command other than explicit `poweroff --confirm` requests shutdown.
- [ ] `lock` does not reset a password when screen locking fails.
- [ ] A partial failure does not print a recovery password as if every target succeeded.
- [ ] `locker` clearly reports not implemented; no false claim that idle locking is enabled.
- [ ] Offline install works without npm registry access when prerequisites exist.
- [ ] Offline installer stops before changes when Node.js 20+ or npm is absent.

## 5. Evidence to attach to a bug report

Include the HomeLAN version/commit, OS and Node.js version, exact command (redact secrets), full stdout/stderr, expected result, actual result, and whether the test was local, mocked, VM-based or against a real client. Never attach passwords, private keys, full `known_hosts`, personal IPs or unredacted device configuration.
