# Python source artifact provenance

| Артефакт | Размер | Дата | Назначение |
|---|---:|---|---|
| `homelan-next.zip` | 86,933 bytes | 2026-11-16 13:26 UTC | Полный пакет текущего Python CLI snapshot |
| `homelan-changes.patch` | 123,032 bytes | 2026-11-16 13:27 UTC | Patch относительно предыдущего дерева |
| `README.md` | 31,896 bytes | 2026-11-16 | README snapshot |
| `architecture.md` | 12,477 bytes | 2026-11-16 | Архитектурный документ |
| `installation.md` | 14,891 bytes | 2026-11-16 | Инструкция установки |

Оригиналы находятся в Library, путь `/Бытовое/`. Файловые ссылки/refs в исходной сессии:
- `homelan-next.zip`: `turn2file4`
- `homelan-changes.patch`: `turn2file2`
- `README.md`: `turn2file3`
- `architecture.md`: `turn2file0`
- `installation.md`: `turn2file1`
- исходный текстовый dump: `turn2file7`
- промежуточный diff: `turn2file5`

В ходе сборки 17.11.2026 чтение ZIP завершилось ошибкой, а raw-byte materialization Library не разрешила копирование. Не выдавать этот snapshot за восстановленный из исходников. Следующий шаг — скачать `homelan-next.zip` из Library и распаковать его в эту папку, сохранив текущий `README.md`/provenance.
