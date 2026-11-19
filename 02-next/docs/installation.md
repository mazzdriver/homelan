# Installation and first enrollment

## Administrator device

1. Install Node.js 20+ and npm.
2. Install OpenSSH Client (`ssh` and `scp`).
3. Install the Admin npm package after publication, or install the local package tarball from `release/npm/`:

   ```sh
   npm install -g ./release/npm/homelan-admin-2.1.0.tgz
   ```

4. Run `homelan init`.

## Target device prerequisites

The current Client adapter targets Linux with systemd, logind, LightDM and an XFCE-compatible graphical session. It requires Node.js 20+, npm, OpenSSH Server, `sudo`, `loginctl`, `light-locker-command` and `chpasswd`. Managed child accounts must already exist and have UID 1000 or higher; only accounts listed in `--managed-users` are eligible for HomeLAN password/time/autologin operations.

The initial package deployment uses SSH/SCP and `sudo -n npm install -g`. Therefore the SSH account must already have a working SSH key and non-interactive sudo rights sufficient for this bootstrap. The later RPC path requires `sudo -n homelan-client rpc --stdio`. This bootstrap privilege model is intentionally explicit and should be tightened with a dedicated root-owned installer/helper before public deployment.

## SSH trust

Verify the target's SSH host-key fingerprint through a trusted channel. Add the verified key to the administrator's `known_hosts`. HomeLAN deliberately does not run `ssh-keyscan` and does not accept unknown keys automatically.

Install the administrator's public key in the target account's `authorized_keys`. HomeLAN uses BatchMode and will fail rather than prompt for an SSH password or key passphrase. Use an ssh-agent if the private key is encrypted.

## Add and enroll a device

```sh
homelan device add example-device-a --address 192.0.2.10 --user adminuser --managed-users child-user
homelan device check example-device-a
homelan client enroll example-device-a
homelan client status example-device-a
homelan client diagnose example-device-a
```

Replace example values with local values; do not commit the real registry. The `device add` operation only edits the local registry and makes no network connection. `client enroll` packages the local client workspace, transfers it over SCP, installs it, writes the stable device ID and managed-user list, and installs the ARM systemd unit.

Before the packages are published, if Admin is installed from its tarball, run it while your current directory is the extracted HomeLAN project root: the CLI will use `release/npm/homelan-client-2.1.0.tgz`. If that artifact is not available in the current directory, it falls back to the published `@homelan/client@2.1.0` registry package. After publication, the fallback works from any directory.

## Password changes

Interactive `newpass` reads the password without echoing it. It can also read from a pipe, avoiding command-line arguments (include `--password-stdin`):

```sh
homelan newpass example-device-a --user child-user
```

The `lock` command generates a random one-time password itself. Save it when shown. If a multi-device lock partially fails, the generated secret is withheld; use `newpass` to establish a known recovery password on each affected device.

## Do not use yet

Do not rely on `locker` for idle locking; it currently stores a pending value and returns `enabled: false`. Do not assume ARM timing is production-accurate until verified on the actual Mint/XFCE machines. TIMER and full staged provisioning are not included.

## Standalone / offline distribution

The standalone bundle is in `release/offline/` and contains the Admin, Client and Protocol tarballs plus installers. The installer first inspects the administrator OS, architecture, Node.js and npm. It makes no changes if Node.js 20+ or npm is missing. npm registry access is not required.

Windows PowerShell:

```powershell
cd .\release\offline
.\install-offline.ps1
```

Linux / macOS / Termux:

```sh
cd release/offline
./install-offline.sh
```

Keep the extracted `release/offline` directory. When deploying a Client from this bundle, run `homelan client enroll <id>` while the current directory is `release/offline`; Admin will use `packages/homelan-client-2.1.0.tgz` rather than reaching npm registry. The target still needs network reachability from the admin host over SSH/SCP. The pre-install POSIX bootstrap can inventory the target before Node.js exists; 2.1 reports Node.js/npm as a prerequisite but does not yet install the runtime automatically.
