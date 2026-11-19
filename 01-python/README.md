# Python CLI snapshot — 2026-11-16

Вчерашний вариант использовал единый Python 3.10+ движок `homelan_core.py` и тонкие оболочки для Bash, PowerShell и CMD. Зависимости Python — только стандартная библиотека; на административном устройстве требовался системный SSH-клиент.

## Команды в snapshot

- `newpass`
- `lock` (ВАЖНО: реализованное тогда поведение — старый lock/autologin, теперь не соответствует новому требованию)
- `autologin`
- `locknow`
- `locker`
- `arm`
- `status`

`timer` и `probe` оставались в legacy `kid-ctl.sh`.

## Проверки, отражённые в changelog

- `bash tests/test_homelan.sh` — успешно; mock SSH, CLI dispatch и сборка payload.
- `bash -n` для payload.
- `python3 -m py_compile homelan_core.py` — успешно.
- Реальные целевые устройства не затрагивались.
- Windows PowerShell, CMD и Termux не подтверждены отдельным прогоном.

## Полная копия

Полный исходный пакет `homelan-next.zip` обнаружен в Library. См. `SOURCE_ARTIFACTS.md` и `../04-source-recovery/`. Он не был подменён неполной реконструкцией.
