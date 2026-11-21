# OBS-001: `locker` is advertised in CLI help but performs no locking in 2.1.0

## Summary

`homelan locker <id> --user <name> --time <minutes>` is listed in `homelan --help` and happily writes `/etc/homelan/locker.json`, but the client returns `enabled: false`, `notImplemented: true`, and the tick handler explicitly reports `executed: false`. The documented behaviour is honest, yet the command still looks actionable to an operator reading only `--help`.

## Impact

An operator may believe an idle-lock timeout is configured and enforced when it is not.

## Suggested fix

Mark the command as unsupported in `--help` (for example `(inactive in 2.1.0)`), or return a non-zero exit status with an explicit notice when it is invoked.
