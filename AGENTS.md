# Agent guidance for HomeLAN

- Treat `03-project-history/DECISIONS.md` as accepted project constraints; consult `BACKLOG.md` before changing scope.
- Never contact real target devices unless the user explicitly authorizes real SSH actions in the current conversation.
- Never put passwords in argv, config files, logs or temporary files. Send secret material through stdin only.
- Never let any command other than the explicit `poweroff --confirm` operation shut down a device.
- Keep `lock`, `locknow`, `newpass`, ARM, LOCKER and TIMER semantically separate.
- Keep the client daemonless: SSH launches a short-lived RPC process. Do not add a listening network service without a new decision.
- Do not accept unknown SSH host keys automatically.
- Keep platform-specific system operations behind client adapters; npm is distribution, not a reason to force all OS behavior into JS.
- Run `cd 02-next && npm test` after code changes. Use mock SSH only unless live access is explicitly authorized.
- Do not call a feature implemented merely because a config value is stored. Report active/inactive behavior accurately.

## Working with limited context (read before changing code)

- Start at `02-next/docs/engineering/README.md`. Pick **one** work packet from `WORK-PACKETS.md` and do only that.
- Run `cd 02-next && npm test && npm run lint && npm run check:protocol` before and after every change; all must pass.
- Edit the protocol only in `packages/homelan-protocol/src/index.js`, then run `npm run sync:protocol`. Never edit the vendored copies by hand.
- After adding or editing files run `npm run manifest:write`. Do not rebuild `release/`, bump versions or change the release artifacts unless the owner asks.
- This repository is hardened by default. Never add intentional weaknesses, backdoors, debug bypasses or "training" shortcuts to it. Anything of that kind belongs outside this repository.
- Do not add real names of people or devices, e-mail addresses, IP addresses or credentials to code, docs, tests, commit messages or fixtures. Use `child1`, `box1`, `192.0.2.10`.
- Tests must be hermetic: no network, no real `$HOME`, no global installs, no real devices.
- If a step cannot be done as written, stop and report instead of improvising.

