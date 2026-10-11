# GAME-FINISH.12 — Legal homebrew acquisition / sample game

- Explicit user request: download a Game Boy game.
- Acquired the author-published **2048 Game Boy Edition** ROM from pinned source `wyattferguson/2048-gb@167788105db659f2049dd2d537ee12f63d87b1e7`, under the MIT license.
- Original Git object `9bae43c7c020af603c64e4e049064e5cbfb183f8` was imported directly and its blob hash was checked for byte-for-byte equality. Full MIT license is retained.
- Added the public sample to `apps/jhadina-web/public/gaming/gameboy/homebrew/2048.gb`. No unlicensed Nintendo ROMs are included. User must manually download and import the homebrew game; it is never pushed automatically into private saves.
- Added structural regression test `scripts/gaming-test-homebrew.mjs` verifying exact blob identity, size, title/header checksum and license metadata in CI.
- Existing EmulatorJS commissioning gate remains. A downloadable ROM is **not** a playable game in Jhadina until the reviewed self-hosted emulator binaries are present and real iPhone gameplay is proven.
- Hades (GBA) and PatBoy (native Game Boy) remain host-only candidates and are not replacements for the phone browser runtime.
- No ROM bytes in Google Drive backup: encrypted local save and history archives still exclude ROM records. The user's Game Core Backups Drive folder remains a backup and receipts destination.
