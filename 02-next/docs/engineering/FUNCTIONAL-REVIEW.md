# Functional review

Method: read all source in `02-next/packages`, ran the suite with coverage, and verified each defect below with a concrete observation. Nothing here was run against a real target device. "Evidence" says how to reproduce the observation.

Legend: ✅ implemented and covered by tests · 🟡 implemented, weakly or only indirectly tested · 🧱 stub (stores a value, does nothing) · ❌ not implemented.

## 1. Feature matrix

### Admin

| Feature | Status | Notes |
|---|---|---|
| `init`, `device add/list/remove` | 🟡 | Validation is thorough; few direct tests (`commands.js` 57% lines) |
| `device check` (SSH reachability) | 🟡 | Uses real `ssh`; no test with a fake binary |
| `client enroll/install/update` (deploy path) | 🟡 | Lines 43–73 of `commands.js` are not covered; ordering (discover → refuse unsupported → install → enroll) is untested |
| `client inspect/plan` | 🟡 | Same: needs fake `scp`/`ssh` tests |
| `client status/diagnose` | ✅ | Via `each()` + preflight |
| `client compat` | ✅ | Matrix logic is unit-tested; CLI printing is not |
| `lock`, `locknow`, `newpass`, `autologin`, `arm`, `locker`, `poweroff` (CLI side) | 🟡 | Parsing and confirmation rules covered only by smoke checks |
| Preflight / negotiation | ✅ | 13 tests, including "secret never sent on refusal" |
| `system inspect` (local OS detection) | 🟡 | `local-system.js` 12% |

### Client

| Feature | Status | Notes |
|---|---|---|
| RPC dispatch, validation, capability refusal | ✅ | |
| System discovery + install plan | ✅ | |
| `status`, `diagnose` | 🟡 | `linux.js` 14%; only reached through mocks of the report |
| `locknow` (logind lock + confirmation) | 🟡 | Logic present; untested |
| `lock` (lock, then password, then parent-lock marker) | 🟡 | Ordering is the core safety property and has **no test** |
| `newpass` (+ usage window reset) | 🟡 | Password via stdin only; untested |
| `autologin` (LightDM drop-in) | 🟡 | Untested; refuses while expired/parent-locked state exists |
| `arm` (active-time limit) | 🟡 | Timer units + per-minute tick; untested; see DEF-004 |
| `poweroff` | 🟡 | Confirmation enforced at both ends |
| `locker` (XFCE idle lock) | 🧱 | Stores minutes, reports `notImplemented:true`, does nothing |
| `timer` | ❌ | Legacy TIMER migration not started (no source) |
| Windows adapter | ❌ | Detected, refused |
| Hardened least-privilege installer | ❌ | Backlog HOM-004 |
| Uninstall / rollback | ❌ | No `client uninstall`; nothing removes units, config or state |
| Operation audit log on the client | ❌ | No record of who did what, when |
| `adminFingerprint` verification | 🧱 | Field exists in client config; never set by `enroll`, never checked |

## 2. Defects

Each has an ID used by the work packets.

### DEF-001 — `installUnits()` references an unimported function (bug, medium)
`packages/homelan-client/src/linux.js` line 77 calls `writeConfig(c)`, but line 5 imports only `STATE_DIR, ensureState, readConfig`. If `/etc/homelan/client.json` does not exist when `install` runs, the operation fails with `writeConfig is not defined`. `enroll` creates the file first, so enroll-then-install works; **install-before-enroll does not**.
Evidence: `node -e` scope check (imported names listed, `writeConfig(` present in source). Fix after WP-02 so a test can reach the line. Packet: **WP-04**.

### DEF-002 — Client `status` reports a hard-coded version (bug, low)
`linux.js` line 25 returns `clientVersion:'2.1.0'` instead of `CLIENT_VERSION`. The version string also appears in the Admin usage text, config defaults and several scripts. Packet: **WP-06**.

### DEF-003 — Duplicate dead branches in the client entry point (cleanup, low)
`bin/homelan-client.js` lines 12–15 handle `inspect` and `plan` twice. Packet: **WP-07**.

### DEF-004 — ARM usage accounting counts ticks, not elapsed time (accuracy, medium)
`armTick()` adds a fixed 60 seconds per run (`used+=60`). If the timer fires late, is skipped (suspend, heavy load, boot delay), or fires more often than expected, the recorded usage diverges from real time. A parent will see children getting more or less time than configured.
Evidence: read `linux.js` `armTick`; reproduce in a fake-clock test (WP-12). Packet: **WP-12** (needs owner approval: it changes behaviour).

### DEF-005 — Protocol-level `lock` without a user locks every graphical session (validation gap, low–medium)
`lock(user,password)` calls `locknow(user)`; with `user` undefined the default `null` applies, so **all** active seat sessions are locked and only then does `setPassword` reject the missing user. The Admin CLI always supplies `--user`, so only a hand-written request reaches this.
Root cause: `validateRequest` checks the envelope only; there is no per-operation parameter schema. Packet: **WP-05**.

### DEF-006 — Version string and defaults are duplicated (maintainability, low)
`2.1.0` appears in `commands.js` (usage, install command, archive names), `config.js` defaults, client `status`, client usage text, package files and release scripts. Packet: **WP-06**.

### DEF-007 — Core OS logic is untestable without root (design, high impact on quality)
`linux.js` mixes decisions with direct `spawnSync` calls and absolute paths, so its 14% coverage cannot be raised by ordinary unit tests. This is the single biggest obstacle to safe changes. Packets: **WP-02**, **WP-03**.

### DEF-008 — `commands.js` is one dense module with module-level state (design)
`const c=loadConfig()` runs at import time and parsing, validation, SSH calls and printing are interleaved, which blocks direct tests. Packet: **WP-09**.

### DEF-009 — Documentation counts drift (docs, low)
`README.md` and `docs/testing.md` state a fixed number of tests (31); the suite now has more. Packet: **WP-01** (stop hard-coding counts).

### DEF-010 — Remote command text is assembled by string interpolation in several places (robustness, medium)
Inputs are validated with regular expressions before use, so no injection is known, but the safety depends on every call site remembering to validate. Packet: **WP-11**.

### DEF-011 — Transport robustness is under-specified (robustness, medium)
`ssh.js` accepts whatever a client sends within the 30-second timeout. Behaviour for very large, truncated or oddly shaped responses is neither bounded nor tested. Packet: **WP-08**.

## 3. Feature gaps worth specifying (not defects)

| ID | Feature | Why | Packet |
|---|---|---|---|
| FEAT-01 | `homelan client uninstall <id>` | A parent must be able to remove HomeLAN cleanly and restore autologin/units | WP-14 |
| FEAT-02 | Client audit log + `homelan client audit <id>` | Answers "who locked/unlocked this and when" without storing secrets | WP-15 |
| FEAT-03 | `--json` output and stable exit codes | Lets scripts and tests assert on results instead of parsing text | WP-16 |
| FEAT-04 | `homelan doctor` (Admin-side self-check) | One command to check ssh binary, known_hosts, config permissions, registry validity | WP-17 |
| FEAT-05 | Dry-run (`--dry-run`) for state-changing operations | Safe rehearsal before touching a real computer | WP-18 |
| FEAT-06 | XFCE LOCKER adapter | Backlog item; needs a real XFCE box to validate | owner-gated |
| FEAT-07 | Windows client adapter | Backlog item; needs Windows hardware | owner-gated |
| FEAT-08 | Hardened installer (exact-command sudoers) | Backlog HOM-004; needs a real Linux Mint box | owner-gated |

## 4. What is **not** verified anywhere

Real SSH, real `loginctl`/`chpasswd`/LightDM/systemd behaviour, XFCE behaviour, behaviour on suspend/resume, multi-user desktops, and Windows. Passing tests mean "the logic is consistent with our mocks", not "it works on the household computers".
