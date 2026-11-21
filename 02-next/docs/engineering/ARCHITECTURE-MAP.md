# Architecture map

Status: describes the code as of the 2.1.0 line plus capability negotiation. Line counts and coverage are a snapshot; regenerate with `npm run test:coverage`.

## 1. What the system is

A parent's **Admin** CLI (Windows, Linux or Termux) controls household computers over **SSH**. On each controlled computer a short-lived **Client** process reads one JSON request from stdin, acts on the local OS, and writes one JSON response. There is no daemon and no listening port. A tiny **Protocol** module defines the message contract and is shared by both sides.

```
 Admin workstation                         Controlled computer
 ┌──────────────────────┐   ssh stdin/out   ┌───────────────────────────────┐
 │ CLI (commands.js)    │ ───────────────►  │ sudo -n homelan-client rpc    │
 │  └ preflight (ping +  │   1 JSON line     │  └ dispatch (index.js)        │
 │    negotiate)         │ ◄───────────────  │     └ linux.js (OS operations)│
 │  └ ssh.js (transport) │   1 JSON line     │        └ loginctl, chpasswd,  │
 │  └ config (registry)  │                   │          systemctl, lightdm   │
 └──────────────────────┘                    └───────────────────────────────┘
         both import: protocol (vendored copies of packages/homelan-protocol)
```

## 2. Module map

| Package / file | Responsibility | Lines | Line coverage | Test seam today |
|---|---|---:|---:|---|
| `homelan-protocol/src/index.js` | Request/response envelopes, error codes, operation list, `negotiate()`, version compare | 85 | 100% | Pure functions, easy |
| `homelan-admin/src/protocol.js`, `homelan-client/src/protocol.js` | **Byte-identical vendored copies** of the file above | 85 each | partial (tests import the canonical file) | Parity test + `npm run check:protocol` |
| `homelan-admin/src/commands.js` | CLI parsing, device registry commands, deploy/enroll, every user-facing command | 99 | 57% | Poor: one dense module, module-level `loadConfig()`, calls `spawnSync` directly |
| `homelan-admin/src/ssh.js` | Builds the `ssh` command, sends one request, validates the response id | 23 | 100% | Good: `spawnImpl` injection |
| `homelan-admin/src/preflight.js` | `ping` + `negotiate()` before every operation; refuses locally | 23 | 100% | Good: injected `invokeFn` |
| `homelan-admin/src/config.js` | Reads/writes `~/.homelan/config.json`, validates device records | 7 | 100% | OK (`HOMELAN_HOME` env) |
| `homelan-admin/src/local-system.js` | Detects the Admin machine's own OS/runtime | 57 | 12% | Poor |
| `homelan-admin/bootstrap/linux.sh`, `homelan-client/bootstrap/linux.sh` | POSIX-shell discovery that runs **before Node exists** on the target; must be identical | 97 each | exercised by 3 tests | Needs hermetic PATH (see `tests/helpers/no-node-env.js`) |
| `homelan-client/src/index.js` | `dispatch()`: validate request → readiness check → capability check → run operation | 39 | 87% | Good: `systemReport` injection |
| `homelan-client/src/system.js` | Discovers OS, desktop, init system, package manager; builds the install plan | 57 | 98% | Good |
| `homelan-client/src/adapters/index.js` | Chooses an adapter from the system report | 8 | 50% | Good |
| `homelan-client/src/linux.js` | **All real OS operations**: lock, password, autologin, ARM timer, poweroff, units | 135 | **14%** | **Very poor**: absolute paths (`/etc/homelan`, `/var/lib/homelan`, `/etc/systemd/system`, `/etc/lightdm`) and direct `spawnSync` |
| `homelan-client/src/config.js` | Client config (`/etc/homelan/client.json`) and state dir | 11 | 73% | Poor: constants are absolute paths |
| `homelan-client/bin/homelan-client.js` | Client entry: `rpc --stdio`, `enroll`, `inspect`, `status`, `internal` | 22 | 0% (only via package tests) | Poor |

## 3. Request lifecycle (operation `lock`)

1. Admin `lock <id> --user <name>` generates a random one-time password locally.
2. `guardedInvoke` → `preflight` sends `ping`; `negotiate()` checks protocol, client version and capabilities. On refusal, **nothing else is sent**.
3. `invoke` runs `ssh … sudo -n homelan-client rpc --stdio` and writes one JSON line; the password travels only in stdin.
4. Client `dispatch`: envelope valid → target ready → capability present → `linux.lock`.
5. `linux.lock`: lock the user's graphical session via logind and confirm `LockedHint=yes`; **only then** `chpasswd`; then write `<user>.parent-locked`.
6. Admin prints the password only if every selected device reported `ok`.

## 4. Trust boundaries

| Boundary | Trusted side | Untrusted / semi-trusted side | Rule |
|---|---|---|---|
| Admin ⇄ SSH ⇄ Client | Admin workstation | **Anything the client returns** | Admin must treat client output as hostile data (size, shape, content). |
| Client ⇄ local OS | Root-run client | Local users, including managed children | Child accounts can write only to their own home; HomeLAN state lives in `/var/lib/homelan` (0700) and `/etc/homelan`. |
| Bootstrap shell | Script shipped in the package | The target's environment (`PATH`, shell) | The bootstrap only **reads** and reports; it never installs. |
| Registry file | Admin user | — | Device records are re-validated at read time (`findDevice`). |

## 5. Invariants (tests should enforce these — see WP-13)

1. No secret ever appears in argv, config files, logs or temp files; secrets go through stdin.
2. Only the explicit `poweroff` operation (with confirmation) may power a machine off.
3. `lock`, `locknow`, `newpass`, `arm`, `locker`, `timer` stay semantically separate.
4. The client never listens on a network socket.
5. SSH host keys are never accepted automatically (`StrictHostKeyChecking=yes`, `BatchMode=yes`).
6. Unsupported platforms fail closed; no Linux commands are attempted on them.
7. A feature is not "implemented" because a config value exists; report active/inactive truthfully.
8. The three protocol copies are byte-identical; the canonical file is `packages/homelan-protocol/src/index.js`.
9. `lock` changes the password only after the screen lock is confirmed.
10. Every operation that needs a capability is refused locally by Admin when the client lacks it (capability negotiation).

## 6. Target structure (what the work packets steer toward)

The goal is *ports and adapters* so that OS behaviour can be tested without root and without a real machine.

```
homelan-client/src/
  ports.js            SystemPort: run(bin,args,{input}), fs (read/write/unlink/exists/mkdir),
                      paths {config,state,systemd,lightdm}, clock.now(), identity.uid()
  adapters/
    linux-systemd.js  createLinuxSystemd(port)  → status, diagnose, locknow, lock, setPassword,
                      setAutologin, setArm, installUnits, armTick …  (pure logic over the port)
    index.js          adapterFor(report, port)
  linux.js            thin wrappers that build the real port (keeps current exports)
homelan-admin/src/
  cli/parse.js        argument parsing (pure)
  cli/devices.js      device add/list/remove/check
  cli/deploy.js       enroll/install/update/inspect/plan (remote command builders + shellQuote)
  cli/operations.js   lock/newpass/arm/… (uses guardedInvoke)
  commands.js         router only
```

Rules for the refactor: **behaviour must not change** in the packet that introduces a seam (characterize first, then move code). Release artifacts (`release/`) are rebuilt only when the owner decides on a version.

## 7. Extension points

- **New platform** (e.g. Windows): add an adapter factory + capability names; the Client reports capabilities in `ping`; Admin refuses unsupported operations before sending.
- **New operation**: add to `OPERATIONS`, `OPERATION_CAPABILITIES` (and `OPERATION_MIN_VERSION` if newer than 2.0.0) in the canonical protocol, run `npm run sync:protocol`, add a `dispatch` case, add tests for refusal and success.
- **New diagnostic**: add a `check(name, fn)` in the adapter's `diagnose()`; it must be read-only.

## 8. Things that look wrong but are intentional

- The protocol is **vendored** into both packages instead of being an npm dependency, so the offline bundle stays self-contained. Do not "fix" this without a decision.
- The Client is launched per request over SSH. Do not add a long-running service.
- Source files use a dense one-statement-per-line style. Match the surrounding style in files you edit; do not reformat whole files in a functional change.
