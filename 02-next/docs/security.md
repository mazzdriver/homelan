# Security notes and threat boundaries

- SSH host key validation is strict (`StrictHostKeyChecking=yes`). Unknown or changed host keys fail closed.
- SSH uses `BatchMode=yes`; no interactive SSH password prompt is attempted.
- RPC payloads and passwords travel through SSH stdin. They are not placed in the remote command string or process argv.
- Client operations are allowlisted. The protocol has no arbitrary shell-execution operation.
- Client runs as root only for the duration of one SSH RPC or systemd timer invocation.
- No persistent TCP listener is installed.
- Admin registry permissions are created as `0700` directory / `0600` file on POSIX systems. Client config and state use restrictive permissions.
- `poweroff` is separate and requires explicit `--confirm`.
- `lock` locks before resetting the password; if locking fails, it does not reset the password.

## Important bootstrap caveat

The current first-install path invokes `sudo npm install -g` on the target. This grants the SSH principal substantial root-level trust during enrollment. Before publishing for general use, replace it with a small root-owned installer that verifies package integrity/signature and accepts only approved versions, then narrow sudoers to that installer plus the exact Client RPC entrypoint. A dedicated HomeLAN SSH identity, enrollment/revocation workflow and signed update/rollback are still backlog items.

## Secret recovery

A successful `lock` prints a one-time random password after all selected devices succeed. Store it in a password manager. If the operation reports partial failure, the password is withheld; use the separate `newpass` command to set a known password on the affected device. ARM expiry uses an unknown random password; the parent recovers access with `newpass`.

## Not yet audited

No independent security audit, package signing, SBOM, npm provenance verification, root installer hardening or real-machine testing has been performed. Do not expose the admin SSH key or target SSH service to untrusted networks.
