# Work packets

Small, self-contained tasks written so that a model with limited context can finish one without guessing. Size tags: **[S]** mechanical, **[M]** needs care, **[L]** structural — give to the strongest model available or have the owner review.

## Rules for every packet

1. Do **one** packet per session. Do not "also fix" nearby things; write them down as notes instead.
2. Read first: `AGENTS.md`, `docs/engineering/ARCHITECTURE-MAP.md` §5 (invariants) and the packet itself.
3. Before touching anything run `npm test && npm run lint && npm run check:protocol` from `02-next/` and record the result. Run them again at the end. All must pass.
4. Protocol changes go **only** in `packages/homelan-protocol/src/index.js`; then run `npm run sync:protocol`. Never edit the two copies by hand.
5. Never contact a real device, never use the network, never put secrets in argv, config, logs or temp files.
6. Do not rebuild `release/`, do not bump versions, do not edit `MANIFEST.sha256` by hand (run `npm run manifest:write` as the last step of a change that adds or edits files).
7. Do not add intentional weaknesses to this repository. It is hardened by default.
8. Match the dense style of the file you edit. Do not reformat unrelated lines.
9. Commit message: `type(scope): summary` plus a `Packet: WP-xx` line. Update `03-project-history/CHANGELOG.md` with one bullet.
10. If a step cannot be done as written, **stop** and add a short "Blocked" note at the bottom of the packet instead of improvising.

## Order and dependencies

```
Wave 1 (independent):  WP-01  WP-06  WP-07  WP-13  WP-19  WP-20
Wave 2 (client core):  WP-02 → WP-03 → WP-04, WP-05
Wave 3 (admin):        WP-09 → WP-10, WP-11, WP-08
Wave 4 (features):     WP-12*  WP-14  WP-15  WP-16  WP-17  WP-18        (* needs owner approval)
Owner-gated:           XFCE LOCKER, Windows adapter, hardened installer, version number, release rebuild
```

---

### WP-01 — CI gates and coverage ratchet **[S]**
**Goal:** make the required checks in `TEST-STRATEGY.md` §3 run automatically.
**Touch:** `.github/workflows/test.yml`, `02-next/package.json`, `README.md`, `02-next/docs/testing.md`.
**Steps:**
1. Add script `"test:coverage:gate": "node --test --experimental-test-coverage --test-coverage-lines=75 --test-coverage-branches=65 --test-coverage-functions=60"` (floors just under today's numbers; Node ≥ 22.8 only).
2. In the workflow add steps: `npm run check:protocol` (all legs); `npm run manifest:check`, a `sh -n` loop over every `*.sh` in the repo, and `npm run test:coverage:gate` — each with `if: runner.os == 'Linux'` (the coverage step also `&& matrix.node == 22`).
3. Replace every hard-coded test count in `README.md` and `docs/testing.md` with the sentence "run `npm test` for the current result" (DEF-009).
**Done when:** the workflow YAML parses; all new npm scripts pass locally; `grep -nE "[0-9]+ tests" README.md 02-next/docs/testing.md` finds nothing.
**Verify:** `npm run test:coverage:gate && npm run check:protocol && npm run manifest:check`.
**Do not:** lower a floor; add Windows/macOS legs to the manifest or coverage steps.

### WP-02 — Introduce `SystemPort` into the client **[L]**
**Goal:** make `linux.js` testable without root, with **no behaviour change**.
**Depends on:** none (blocks WP-03, WP-04, WP-12, WP-14, WP-15).
**Touch:** new `packages/homelan-client/src/ports.js`; `linux.js`; `config.js`; `adapters/index.js`.
**Steps:**
1. Create `ports.js` exporting `createRealPort()` returning `{ run(bin,args,{input,timeout}), fs:{readFile,writeFile,exists,unlink,mkdir,rename}, paths:{config:'/etc/homelan',state:'/var/lib/homelan',systemd:'/etc/systemd/system',lightdm:'/etc/lightdm/lightdm.conf.d'}, now(), uid() }`. `run` must behave exactly like the current `run()` in `linux.js` (same errors, same timeout default).
2. In `linux.js` replace every `spawnSync`, `fs.*` call and absolute path with `port.*`. Each exported function gets an optional **last** parameter `port = createRealPort()`. Export signatures stay otherwise identical.
3. Give `config.js` (`readConfig`, `writeConfig`, `ensureState`) an optional `paths`/`fs` parameter the same way.
4. Create `tests/helpers/fake-port.js`: an in-memory filesystem, a recorded call list, and a scriptable `run` (map of `"bin arg arg"` → output or error).
5. Do not add any new behaviour. Do not fix DEF-001 here.
**Done when:** the existing 44+ tests pass unchanged; `grep -nE "spawnSync|'/etc/|'/var/" packages/homelan-client/src/linux.js` prints nothing; one smoke test calls `status()` with the fake port.
**Verify:** `npm test && npm run lint && npm run test:coverage`.
**Do not:** rename exports; change messages; touch the admin package.

### WP-03 — Client operation tests on the fake port **[M]**
**Depends on:** WP-02.
**Goal:** implement TG-C01 … TG-C12, TG-C14, TG-C16 … TG-C18, TG-C20 from `TEST-STRATEGY.md` §5.1.
**Touch:** new `tests/client-ops.test.js` (split into two files if it exceeds ~300 lines).
**Done when:** every listed TG ID has at least one test whose name contains the ID; `linux.js` line coverage ≥ 85%; TG-C05 (no password change when the lock fails) and TG-C07 (password only in `input`) are present.
**Verify:** `npm run test:coverage` shows `linux.js` ≥ 85%.
**Do not:** change production code. If a test exposes a bug, mark that test `{todo: 'DEF-nnn'}` and report it.

### WP-04 — Fix DEF-001 (`writeConfig` not imported) **[S]**
**Depends on:** WP-02, WP-03.
**Steps:** import/use the config writer through the port; add TG-C15 (installing with no `client.json` creates it and writes both unit files, mode 0644, then reloads systemd).
**Done when:** TG-C15 passes and failed before the fix (show the failing run in the commit message).

### WP-05 — Per-operation parameter validation **[M]**
**Goal:** close DEF-005; a request with missing/mistyped params is refused before any OS call.
**Touch:** `packages/homelan-protocol/src/index.js` (then `npm run sync:protocol`), `packages/homelan-client/src/index.js`, tests.
**Steps:**
1. Add `OPERATION_PARAMS` (operation → `{required:{name:type}, optional:{name:type}}`) and `validateParams(operation, params)` returning an error string or `null`. Types: `string`, `boolean`, `integer`. Use: `locknow {optional user:string}`, `newpass {required user,password:string}`, `lock {required user,password:string}`, `autologin {required user:string, enabled:boolean}`, `locker.set`/`arm.set {required user:string, minutes:integer}`, `poweroff {required confirmed:boolean}`; all other operations take no params.
2. Call it in the client `dispatch()` right after `validateRequest`; failure → `INVALID_REQUEST`.
3. Add tests including TG-C19 (a `lock` without `user` touches no session) and a table covering every operation with good and bad params.
**Done when:** unknown extra params are rejected; `npm run check:protocol` passes.
**Do not:** loosen the existing password/minutes checks in `linux.js` (defence in depth).

### WP-06 — One version source **[S]**
**Goal:** DEF-002 and DEF-006.
**Steps:**
1. Use `CLIENT_VERSION` from the protocol for the client `status()`, client usage text, Admin usage text and `client.packageVersion` default.
2. Add `tests/versions.test.js` asserting that every workspace `package.json` version, `CLIENT_VERSION`, and the offline `SHA256SUMS` package names agree.
**Done when:** `grep -rn "2\.1\.0" packages --include=*.js` shows only the `CLIENT_VERSION` definition (and archive-name fallbacks derived from it).
**Do not:** change the version number.

### WP-07 — Remove dead branches in the client entry point **[S]**
**Steps:** delete the duplicated `inspect`/`plan` lines (DEF-003); add `tests/client-bin.test.js` that spawns `bin/homelan-client.js` (no args → usage text; `inspect` → valid JSON; unknown command → usage) using `process.execPath`.
**Done when:** tests pass; the file has one branch per command.

### WP-08 — Bound and sanitize transport output **[M]**
**Goal:** DEF-011.
**Touch:** `packages/homelan-admin/src/ssh.js`, a new `packages/homelan-admin/src/terminal.js`, tests.
**Steps:**
1. In `ssh.js` stop accumulating after `MAX_RESPONSE_BYTES` (1 MiB for stdout, 64 KiB for stderr): kill the child and reject with `SshError(..., 'RESPONSE_TOO_LARGE')`.
2. Add `sanitizeForTerminal(text)` removing control characters except `\n` and `\t` and collapsing very long lines; use it wherever stderr or client-supplied text is printed (`commands.js` error paths).
3. Tests (TG-A10) with a fake `spawnImpl`: oversized output, truncated JSON, wrong response id, non-object result, `__proto__` keys, ANSI escape sequences in messages.
**Done when:** none of those cases throws an unhandled exception; the printed text contains no raw ESC bytes.

### WP-09 — Split `commands.js` **[L]**
**Goal:** DEF-008, per `ARCHITECTURE-MAP.md` §6.
**Steps:**
1. Before moving code, add a golden test capturing `homelan --help` and the error text for an unknown command.
2. Create `cli/parse.js` (pure `parse`), `cli/devices.js`, `cli/deploy.js`, `cli/operations.js`; keep `commands.js` as the router exporting `main(argv)`.
3. Remove the module-level `const c=loadConfig()`: load config inside `main` and pass `cfg` down.
4. Export pure functions and add TG-A01 … TG-A07, TG-A11, TG-A13.
**Done when:** the golden test and all earlier tests pass unchanged; `commands.js` ≤ 60 lines.
**Do not:** change any command's output or flags.

### WP-10 — Deploy-path tests with fake `ssh`/`scp` **[M]**
**Depends on:** WP-09.
**Steps:** create executable fake `ssh`, `scp` (and `npm` if needed) scripts in a temp dir placed first in `PATH`; each appends its argv as one JSON line to a log and replies according to an env var scenario (`ok`, `unsupported`, `not-ready`, `scp-fails`). Implement TG-A08 and TG-A12 (see `tests/ssh-failure.test.js` for the pattern).
**Done when:** ordering and the "nothing installed when unsupported/not ready" cases are asserted; no argv contains a password; all ssh/scp calls carry `BatchMode=yes` and `StrictHostKeyChecking=yes`.

### WP-11 — Remote command builders and `shellQuote` **[M]**
**Depends on:** WP-09.
**Steps:**
1. In `cli/deploy.js` add `shellQuote(value)` (wrap in single quotes, replace `'` with `'\''`) and pure builders `buildBootstrapCommand`, `buildInstallCommand`, `buildEnrollCommand` that quote **every** interpolated value.
2. Tests (TG-A09): for hostile strings (`; rm -rf ~`, `$(id)`, backticks, quotes, spaces, newline) run `sh -c "printf %s $(shellQuote value)"` and assert the output equals the original value.
**Done when:** no remote command string in `cli/` is built by bare interpolation (grep shows builders only); validation regexes stay in place.

### WP-12 — ARM accounting by elapsed time **[L, owner approval required]**
**Goal:** DEF-004. Add a `DECISIONS.md` entry first and wait for owner approval.
**Spec:** store the last tick time in `/var/lib/homelan/arm.last-tick` (0600). Each tick adds `min(now − last, 300 s)` to a user's usage only if the session is active, not idle, and not locked; a missing file adds 60 s; a negative difference (clock moved back) adds 0. Behaviour for locked/expired/parent-locked users is unchanged.
**Tests:** TG-C13 with a fake clock: on-time ticks, a late tick, a tick after suspend (capped), clock moving backwards.

### WP-13 — Invariant tests **[S]**
**Goal:** turn `ARCHITECTURE-MAP.md` §5 into executable checks in `tests/invariants.test.js`.
**Checks (static scans of `packages/*/src` and `bin`):** (1) no `createServer`, `.listen(`, `dgram`; (2) the string `'poweroff'` is run via `systemctl` in exactly one function; (3) every `StrictHostKeyChecking` occurrence is `=yes`, never `no` or `accept-new`; (4) every `chpasswd` call passes `input`; (5) no argument array contains a variable named `password`; (6) every name in `OPERATIONS` has a `dispatch` case (TG-P01).
**Done when:** the test fails if you temporarily violate each rule (try one, then revert).

### WP-14 — `client uninstall` **[M]**
**Depends on:** WP-02. **Needs a version decision** for `OPERATION_MIN_VERSION` (use the placeholder `2.2.0` and flag it).
**Spec:** new operation `uninstall {purge:boolean}`; stops and disables the ARM timer, removes the two unit files and the LightDM autologin drop-in, runs `daemon-reload`; with `purge:true` also removes `/etc/homelan` and `/var/lib/homelan`. Never deletes user accounts or home directories. Admin: `homelan client uninstall <id> [--purge] --confirm`. Capability: reuse `arm`.
**Tests:** fake port; confirm refused without `--confirm`; idempotent when nothing is installed.

### WP-15 — Client audit log **[M]**
**Depends on:** WP-02.
**Spec:** append one JSON line `{ts, operation, user?, ok, code?}` to `/var/lib/homelan/audit.log` (0600) for every state-changing operation; **never** log params, passwords or response bodies. Rotate at 1 MiB, keep 3 files. New read-only operation `audit.tail {lines:integer 1..200}`; Admin `homelan client audit <id> [--lines N]`.
**Tests:** feed a password through `newpass` and assert it is absent from the log; rotation; bounds on `lines`.

### WP-16 — `--json` output and stable exit codes **[M]**
**Depends on:** WP-09.
**Spec:** global `--json` prints exactly one JSON document to stdout (human text goes to stderr). Exit codes: `0` success, `1` operation failed or partial, `2` usage/validation error, `3` SSH/transport failure, `4` refused by preflight. Document both in `docs/cli-reference.md`.
**Tests:** one per exit code, using fake ssh.

### WP-17 — `homelan doctor` **[S]**
**Depends on:** WP-09.
**Spec:** Admin-side checks, no network: Node ≥ 20; `ssh`, `scp`, `ssh-keygen` present; config file permissions (0600 on POSIX); every registered device passes `findDevice`; each device address has a `known_hosts` entry (`ssh-keygen -F`). Print a pass/fail list; exit 1 on any failure.
**Tests:** fake `ssh-keygen` and a temp `HOMELAN_HOME`.

### WP-18 — `--dry-run` **[M]**
**Depends on:** WP-09.
**Spec:** for `lock`, `newpass`, `autologin`, `arm`, `locker`, `poweroff`, `client install`: print the device, operation and parameters (secrets shown as `***`), run only `ping` + negotiation, and send nothing that changes state. Print the negotiation verdict.
**Tests:** with a fake ssh, the recorded operations are exactly `['ping']`.

### WP-19 — Publication hygiene scan **[S]**
**Spec:** `scripts/scan-sensitive.mjs` walks the repo (skip `.git`, `node_modules`) and reports `file:line` with the match **masked** for: private-key blocks, common token prefixes (`ghp_`, `github_pat_`, `sk-`, `AKIA`), e-mail addresses other than `@example.*` and `noreply`, private-range IPs other than the documentation range `192.0.2.0/24`, and any regular expression listed (one per line, case-insensitive) in the file named by the environment variable `HOMELAN_SCAN_DENYLIST` — a file the owner keeps **outside** the repository. Exit 1 on findings. Add `npm run scan:sensitive` and a Linux CI step (without a deny list).
**Tests:** a temp tree with planted findings and an allowed example.

### WP-20 — Table-driven discovery tests **[M]**
**Goal:** TG-S01 and TG-B01 (raises `system.js` branch coverage from 31%).
**Steps:** if `inspectSystem()` cannot take injected inputs, add an optional parameter `{platform, env, readFile, which}` that defaults to the real sources (no behaviour change). Add fixtures under `tests/fixtures/os-release/` (Mint, Ubuntu, Debian, Fedora, Arch, Alpine) and a table test of expected `adapter`, `supported`, `ready` and plan steps; run the bootstrap script against fixtures with a fake `uname` and compare with the JS result for the same fixture.
**Done when:** `system.js` branch coverage ≥ 80%.

---

## Prompt template for handing a packet to another model

> You are working on the HomeLAN repository (`02-next/`). Read `AGENTS.md` and `docs/engineering/ARCHITECTURE-MAP.md` §5 first. Then do **only** work packet `WP-xx` from `docs/engineering/WORK-PACKETS.md`, following "Rules for every packet". Run `npm test && npm run lint && npm run check:protocol` before and after. Do not contact real devices, do not use the network, do not rebuild `release/`, do not change version numbers. When finished, reply with: files changed, test results before/after, and anything you were unsure about. If a step is impossible as written, stop and say why.
