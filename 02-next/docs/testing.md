# Test strategy and current results

Run from `02-next/` with Node.js 20+:

```sh
npm ci
npm test
npm run lint
npm run test:admin-smoke
```

The automated suite uses Node's built-in test runner. It does not connect to real HomeLAN targets or perform privileged client operations.

Coverage includes:

- RPC envelope validation, protocol versioning, operation allowlisting and JSON-lines handling;
- Admin CLI help, local config/device registry operations, input validation and the explicit poweroff confirmation guard;
- SSH argument construction, strict host-key checking, stdin transport, malformed/mismatched responses, connection failures, remote exit failures and timeout handling;
- Client capability gates, unsupported-platform refusal, discovery and declarative plans;
- POSIX bootstrap output and missing-Node behavior;
- package layout, vendored protocol consistency and offline installer preflight;
- Admin workstation smoke checks using a temporary isolated config and a synthetic TEST-NET device ID/address.

`npm run test:admin-smoke` is safe to run repeatedly on the Admin workstation. It does not make a network connection. For the separately controlled SSH and real-client checks, follow [`testing-admin.md`](./testing-admin.md).

## What is not proven by these tests

- SSH server configuration, sudoers permissions and host-key enrollment on a real target;
- package installation and rollback on the target OS;
- actual logind/XFCE/LightDM behavior;
- ARM accounting accuracy and systemd timer lifecycle on a real desktop session;
- Windows PowerShell offline installer execution;
- Windows or macOS Client adapters.

No live household device is contacted by CI, local tests or the Admin smoke script. Real-device checks must be performed manually and recorded separately from automated test results.
