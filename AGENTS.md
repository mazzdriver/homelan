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
