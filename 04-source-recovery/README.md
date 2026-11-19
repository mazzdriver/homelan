# Source recovery checklist

The following source artifacts exist in Library but could not be copied as raw bytes into this build environment.

1. Download `homelan-next.zip` (86,933 bytes) from `/Бытовое/homelan-next.zip`.
2. Extract into `01-python/` (or preserve the extracted directory as `01-python/homelan-next/`).
3. Download `homelan-changes.patch` (123,032 bytes) and keep it under `01-python/patches/`.
4. Import `Вставленный текст.txt` (154,457 bytes, 2977 lines) into `00-legacy/source-dump.txt`.
5. Split the legacy dump at `========== <path> ==========` headers to recover exact original files. Verify line endings and executable bits.
6. Compare extracted Python package with the patch and create a checksum manifest.
7. Update `01-python/SOURCE_ARTIFACTS.md`, then commit the recovered sources as a distinct Git commit.

Do not copy the user-specific `homelan.json` from the old snapshot into a public repository. Replace it with `homelan.example.json` and keep real local config ignored.
