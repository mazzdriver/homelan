# Engineering guide

Documents for anyone (human or model) who changes this code. Read in this order.

| # | File | Read it to learn |
|---|------|------------------|
| 1 | [`ARCHITECTURE-MAP.md`](ARCHITECTURE-MAP.md) | Where everything lives, how data flows, what must never change, and the target structure |
| 2 | [`FUNCTIONAL-REVIEW.md`](FUNCTIONAL-REVIEW.md) | What works, what is a stub, and the known defects (with evidence) |
| 3 | [`TEST-STRATEGY.md`](TEST-STRATEGY.md) | Current coverage, the required checks (gates), and test conventions |
| 4 | [`WORK-PACKETS.md`](WORK-PACKETS.md) | Small, self-contained tasks. **Pick one packet, do only that packet.** |

Existing documents still apply: [`../architecture.md`](../architecture.md), [`../security.md`](../security.md), [`../testing.md`](../testing.md), [`../testing-admin.md`](../testing-admin.md), and the project constraints in `../../../03-project-history/DECISIONS.md`.

Quick start for any change:

```sh
cd 02-next
npm test && npm run lint && npm run check:protocol   # must all pass before and after
npm run test:coverage                                 # see which lines your tests reach
```
