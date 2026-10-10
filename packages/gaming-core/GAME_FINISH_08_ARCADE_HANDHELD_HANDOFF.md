# GAME-FINISH.08 — Native handheld emulators + original arcade

## Upstream audit / pinned sources

| Project | SHA (source baseline) | Licensed | Target | Runtime type | Current admission |
| --- | --- | --- | --- | --- | --- |
| Hades | `e12e42d7c563db9c12092406b06ca015ba938f9f` | GPL-2.0-only | Game Boy Advance / `.gba` | Desktop SDL3/OpenGL, Windows/Linux/macOS | Candidate; installed executable, BIOS and phone streaming unverified |
| PatBoy | `2b411814e2e264ac7a5c999c80f70311e5da438d` | MIT (retain copyright/license in redistributions) | Game Boy / `.gb` | Native Windows Win64 / SDL2 OpenGL debugger | Candidate; compiled binary and gameplay unverified |

Hades upstream source: https://github.com/hades-emu/Hades ; PatBoy: https://github.com/Jonazan2/PatBoy

**Important distinction:** Hades does **not** supply a Game Boy browser runtime; PatBoy does **not** supply a GBA browser core. Neither is installed/bundled or running on the phone.

## Implementation
- Existing `@jhadina/gaming-core` runtime registry now discovers these candidates.
- `NativeHandheldEmulatorDriver` provides opt-in, host-owned verified source revision, SHA-256-installed binary attestation, explicit operator approval and provenance/license gates.
- Hades additionally requires attested local Game Boy Advance BIOS supplied legally by the operator, never automatically downloaded.
- Host owns absolute ROM path, platform, bytes-verified digest, and controller mapping. Browser or library `contentUri` is never passed to an OS process.
- PatBoy argument vector: `[approvedAbsoluteRomPath]`; Hades: `['--bios',verifiedAbsoluteBiosPath,approvedAbsoluteRomPath]`; the host implementation must use shell=false and process isolation. No shell execution is performed inside the package.
- Session handles use the canonical managed orchestrator; invalid process identities trigger a stop attempt and deny certification.
- **Do not** classify these runtimes as deployable until native binaries are built and independent execution and save restore are proven.

## First original playable arcade
`apps/jhadina-web/public/gaming/neon-run/` contains Jhadina-owned original canvas game `Neon Run` — no ROMs, commercial game content, paid accounts, or emulator binaries; touch drag, keyboard and browser Gamepad API input, lives, shield pickups, star scoring, browser-local high score. `/gaming` now links it. Intended mobile landscape, but CI cannot certify a real iPhone/gamepad until physical tests.

## Google Drive continuity
- Existing Drive folder: https://drive.google.com/drive/folders/1mKUoNatRke0g9xgD_9hYX36NIHQy052y
- Encrypted save/library backup export and restore retain no ROM bytes, no license keys and no emulator binaries.
- Synthetic encrypted canary exists in Drive as `JHADINA-GAME-CORE-SYNTHETIC-ENCRYPTED-CANARY-2026-10-10.json`, uploaded and independently fetched as same-size 1030-byte artifact, with true isolated state restore not yet verified.
- A genuine game backup has not been uploaded. Drive is for receipts/backup, never executable hosting or automatic BIOS/ROM sourcing.

## Blockers / next
- Complete exact-head CI, fix any regressions. Review and merge PR only after gate verification.
- Native hosts must be commissioned later; phone is still control/display. Hades GUI/BIOS and PatBoy Win64 should be separately validated.
- Native ROM paths should remain internal to privileged host process. Never auto-activate remote execution based on cloud data.
- Verify the original arcade on physical iPhone and optional gamepad; certify touch input, landscape, score persistence, and restart.
- Integrate local game's high scores into versioned encrypted Drive backups in a future migration; never claim that an archival format handles it until tested.
