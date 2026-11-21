# Test strategy, required checks and coverage plan

## 1. Where we are (snapshot — regenerate with `npm run test:coverage`)

44 tests, all mock-based, no real target contacted. Overall: **75.8% lines, 69.7% branches, 66.8% functions** — but the number hides the problem:

| File | Lines | Branches | Why it matters |
|---|---:|---:|---|
| `homelan-client/src/linux.js` | **14%** | 100%* | Every real OS operation (lock, password, autologin, ARM) lives here |
| `homelan-admin/src/local-system.js` | 12% | 100%* | Admin-side OS detection |
| `homelan-admin/src/commands.js` | 57% | 34% | Whole CLI incl. deploy/enroll |
| `homelan-client/src/adapters/index.js` | 50% | 100%* | Adapter selection |
| `homelan-client/src/config.js` | 73% | 100%* | Client config/state paths |
| `homelan-client/src/index.js` | 87% | 59% | Dispatcher |
| `homelan-client/src/system.js` | 98% | **31%** | Discovery: most distro/desktop combinations are never exercised |
| `homelan-protocol/src/index.js` | 100% | 88% | Contract and negotiation |
| `homelan-admin/src/{ssh,preflight,config}.js` | 100% | 60–87% | Good |

\* a branch figure of 100% on a file with low line coverage only means the few covered lines have no untested branches.

The vendored `protocol.js` copies show partial coverage only because tests import the canonical file; byte-equality is enforced separately.

**Conclusion:** the plumbing is well tested; the code that actually changes passwords, locks screens and runs timers is essentially untested. Raising coverage there is the priority, and it requires the seam described in `ARCHITECTURE-MAP.md` §6 (WP-02).

## 2. Test layers

| Layer | What it proves | Tools | Runs in CI | State |
|---|---|---|---|---|
| L0 Static | Syntax, protocol copies in sync, manifest, shell syntax, invariants, no personal/secret strings | `npm run lint`, `check:protocol`, `manifest:check`, `sh -n`, invariant tests, hygiene scan | yes | partial (WP-01, 13, 19) |
| L1 Pure unit | Protocol, negotiation, argument parsing, command builders | `node:test` | yes | good for protocol; missing for CLI |
| L2 Adapter on a fake port | Decisions and ordering of OS operations without root | fake `SystemPort` (WP-02) | yes | **missing** |
| L3 Transport/integration with fake binaries | ssh/scp argument shape, ordering, hostile responses | fake `ssh`/`scp` scripts in a temp `PATH` | yes | partial (`ssh-failure.test.js`) |
| L4 Real-OS integration | Real `loginctl`, `chpasswd`, systemd units | disposable Linux VM with systemd and a throw-away user | no (manual/scripted) | missing |
| L5 Supervised hardware | Real household computers | `docs/testing-admin.md` checklist | no | pending owner |

Rule of thumb: a bug found at L4/L5 earns a regression test at the **lowest layer that can reproduce it**.

## 3. Required checks (the gates)

A change is mergeable only if every gate that exists passes. Commands run from `02-next/` unless noted.

| Gate | Command | Where | Status |
|---|---|---|---|
| G1 Syntax | `npm run lint` | all CI legs | exists |
| G2 Tests | `npm test` | all CI legs | exists |
| G3 Protocol copies identical | `npm run check:protocol` | all CI legs | script exists; **add to CI** (WP-01) |
| G4 Coverage ratchet | `npm run test:coverage` with per-file floors | Node 22 Linux leg | missing (WP-01) |
| G5 Manifest current | `npm run manifest:check` | Linux leg only (line endings differ on Windows) | script exists; **add to CI** (WP-01) |
| G6 Admin smoke | `npm run test:admin-smoke` | Linux leg | exists |
| G7 Shell syntax | `sh -n` on every `*.sh`; PowerShell parse check on `*.ps1` where available | Linux leg | missing (WP-01) |
| G8 Publication hygiene | `node scripts/scan-sensitive.mjs` (patterns + optional private deny-list) | Linux leg | missing (WP-19) |
| G9 Invariants | `node --test tests/invariants.test.js` | all legs | missing (WP-13) |
| G10 Release integrity | `release/offline/SHA256SUMS` matches tarballs; tarball contents match package sources | on release only | partial |

Coverage ratchet policy: floors start just **below** today's per-file numbers so nothing can regress, and are raised in the same commit that adds the tests. Never lower a floor without an owner decision. `linux.js` floor target after WP-03: ≥ 85% lines.

## 4. Conventions every test must follow

1. **Hermetic.** No real network, no real `$HOME`, no global installs, no files outside a temp dir, no dependence on installed Node being absent. Use `makeNoNodeEnv()` when a test must simulate a machine without Node.
2. **Platform-aware.** Tests that need a POSIX shell use `POSIX_ONLY`; Linux-only facts use `LINUX_ONLY` (`tests/helpers/platform.js`).
3. **Deterministic.** Inject clocks and randomness; never `sleep`.
4. **Secrets.** Any test that handles a password must assert it never appears in recorded argv, logs or thrown messages.
5. **One behaviour per test**, named as a sentence ("lock does not change the password when the screen lock fails").
6. **Fakes over mocks of internals.** Use fake `ssh`/`scp` executables, a fake `SystemPort`, and temp directories. Do not monkey-patch module internals.
7. **Every refused operation is asserted twice**: it returns the right error code *and* nothing else happened (no extra calls recorded).
8. **Match file style.** Existing sources are dense; keep edits local; do not reformat unrelated lines.
9. New test file = new `tests/<area>.test.js`; shared helpers go in `tests/helpers/`.

## 5. Test specifications (backlog of tests to write)

Format: **ID — Given … When … Then …**. Packets in `WORK-PACKETS.md` reference these IDs.

### 5.1 Client operations on a fake port (needs WP-02; implement in WP-03)

| ID | Specification |
|---|---|
| TG-C01 | Given no seat sessions, when `locknow()`, then it throws "No active seat session…" and claims nothing locked |
| TG-C02 | Given logind reports `LockedHint=no` after `lock-session`, when `locknow`, then that session has `locked:false` and overall `ok:false` |
| TG-C03 | Given sessions for `root` and `gdm`, when `locknow()`, then they are never locked |
| TG-C04 | Given a user not in `managedUsers`, when `locknow(user)`, then it throws and runs no `loginctl lock-session` |
| TG-C05 | Given the screen lock fails, when `lock(user,pw)`, then **`chpasswd` is never called**, `passwordChanged:false`, `skipped:true`, `ok:false` |
| TG-C06 | Given lock succeeds, when `lock`, then calls occur in order lock-session → chpasswd → write `<user>.parent-locked` (mode 0600) |
| TG-C07 | Given passwords shorter than 12, longer than 256, or containing `:`, newline or NUL, when `setPassword`, then each is rejected; the accepted password appears only in the runner's `input`, never in `args` |
| TG-C08 | Given `resetUsage`, when `setPassword`, then `.use`, `.expired`, `.parent-locked` are removed; given an unwritable state dir, then the result is `partialFailure:true` |
| TG-C09 | Given UID < 1000 or a non-managed user, when `assertLocalUser`/`assertManagedUser`, then it refuses |
| TG-C10 | Given `expired` or `parent-locked` state, when `setAutologin(true,user)`, then it throws; `setAutologin(false,user)` writes an empty `autologin-user=` |
| TG-C11 | Given minutes outside 0..1440 or non-integer, when `setArm`/`setLocker`, then it throws; `arm.json` is written 0600; the timer is enabled iff any user has minutes > 0 |
| TG-C12 | Given the ARM tick, then it skips `expired`/`parent-locked` users, counts only active, non-idle, unlocked sessions, and at the limit locks then resets the password and writes `.expired`; if already locked and over the limit it retries the reset |
| TG-C13 | (after WP-12) Given a fake clock with a late or missed tick, then usage equals elapsed wall-clock time, capped per tick |
| TG-C14 | Given any operation other than `poweroff`, then `systemctl poweroff` is never invoked; `poweroff` without `confirmed:true` is refused at dispatch |
| TG-C15 | Given no `client.json`, when `installUnits`, then both unit files are written (0644), `daemon-reload` runs, and the config file is created (DEF-001) |
| TG-C16 | Given state files, when `status`, then `managedUserStates` reflects them; given `hostname` failing, then `unknown` |
| TG-C17 | Given one failing check, when `diagnose`, then other checks still report and `ok:false` |
| TG-C18 | Given bad device ids or users, when `enroll`, then it throws; duplicates are removed; UID < 1000 refused |
| TG-C19 | (after WP-05) Given `lock` without `user`, when dispatched, then `INVALID_REQUEST` and **no session is touched** |
| TG-C20 | Given several lines on stdin, when `rpc --stdio` handles them, then one response per line in order; an invalid JSON line yields `INVALID_REQUEST` and the loop continues |

### 5.2 Admin CLI (needs WP-09; implement in WP-09/WP-10)

| ID | Specification |
|---|---|
| TG-A01 | `parse()`: flags with values, boolean flags, missing value error, positional handling |
| TG-A02 | `addDevice`: table of bad ids/addresses/users/ports/managed users each rejected; success writes the registry with mode 0600 |
| TG-A03 | `removeDevice`: unknown id errors; success removes exactly one |
| TG-A04 | `target('all')` with an empty registry errors with the hint to add a device |
| TG-A05 | `secret()`: piped stdin trims exactly one trailing newline; empty errors; `newpass` while piping requires `--password-stdin` |
| TG-A06 | `each()`: exit code 1 when any result has `partialFailure`, `ok:false` or `notImplemented` |
| TG-A07 | `lock`: recovery password printed only if **every** device succeeded; otherwise withheld with an explanation |
| TG-A08 | Deploy with fake `ssh`/`scp`: order is discovery → refuse unsupported → refuse not-ready → install → enroll → `install` RPC; no password in any argv |
| TG-A09 | Remote command builders quote hostile ids, users and file names (after WP-11) |
| TG-A10 | Hostile client responses (wrong id, non-JSON, enormous, `__proto__` keys, control characters) never crash Admin and never print raw control characters (after WP-08) |
| TG-A11 | `compat` prints `allowed` and `blocked` with reasons for a modern and an old fake client |
| TG-A12 | Every ssh/scp invocation includes `BatchMode=yes` and `StrictHostKeyChecking=yes` and never `no`/`accept-new` |
| TG-A13 | `loadConfig`: invalid JSON gives a clear error; nested defaults survive a partial config |

### 5.3 Protocol, discovery, packaging

| ID | Specification |
|---|---|
| TG-P01 | Every name in `OPERATIONS` has a `dispatch` case (introspect the `switch`) |
| TG-S01 | Table-driven `inspectSystem`/`buildInstallPlan`: Mint+XFCE+systemd, Ubuntu+GNOME, Debian, Fedora, Arch, Alpine (no systemd), macOS, Windows → expected adapter, `supported`, `ready`, plan steps |
| TG-B01 | Bootstrap script with fixture `/etc/os-release` and fake `uname`: JSON valid for each fixture; identical output from `sh` and `dash`; never writes files |
| TG-K01 | Packed tarball contains no `tests/`, no `.git`, no personal strings; `package.json` `files` lists every runtime path (`preflight.js` included) |
