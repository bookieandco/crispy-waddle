# GAME-LIBRARY.2 — Portrait Game Boy Pocket UI + low-overhead controls
Date: 2026-10-10 (user local)
Repo: bookieandco/crispy-waddle
Branch: game-core-audit-repair
Draft PR: https://github.com/bookieandco/crispy-waddle/pull/1200

## Owner direction
- User tested the actual Game Boy / licensed 2048 pilot on iPhone and confirmed it **works**, but criticized the existing UX as landscape-first, unattractive, cluttered and laggy.
- Required UX: **portrait play**, body resembling a Game Boy handheld, the game SCREEN above physical-looking D-pad + A/B + Start/Select; game library kept on the SAME page; game must remain mounted when opening/closing library; minimize per-frame work.
- Two private cartridges are in owner-private Google Drive: Pokémon Red (1,048,576 bytes) and Super Mario Land (65,536 bytes). Their IDs, metadata and owner-only permissions are documented in the existing owner-private Drive handoff (not in public assets).
- No cartridge ROMs are included in this commit. Owner imports lawfully held local .gb/.gbc/.zip from iPhone Files; the app does not fetch restricted ROM bytes from public GitHub or Google Drive.

## Implemented
1. Parent `/gaming/gameboy/index.html`: compact Jhadina Pocket header, portrait hardware silhouette, no 16:9 landscape constraint; one large persistent iframe; immediately accessible Play/Save/Stop bar; library collapsed into a `<details>` drawer after the console with existing installed/private-catalog cards and import path; backup tools moved to separate collapsed area.
2. Iframe `/gaming/gameboy/player.html`: branded inset Game Boy-style screen bezel and actual 160×144 emulated display; dedicated large touch D-pad, A/B and Start/Select hit areas under the screen; static CSS skin only, no large framework/remote imagery, retains native canvas.
3. Performance hypothesis: eliminate a redundant rAF loop that scanned gamepads every 16ms when none was connected. Scan at 200ms without a pad (250ms in background), revert to per-frame rAF when a physical controller is present. This reduces unnecessary JS scheduling; physical frame-time and play latency NOT YET measured.
4. Add touchcancel listeners to release D-pad and buttons on iOS interruptions, keeping existing touchstart/end controls. This prevents phantom held buttons after iOS gestures.
5. Existing `activeGameId` and `pendingSwitch` safeguards remain unchanged: switching must wait for state-persist acknowledgement and must never write an old game's save under a newly selected game. The iframe stays mounted on library drawer open/close.
6. Regression test `scripts/gaming-test-portrait.mjs` checks valid inline scripts, responsive shell/layout, touch input bindings, no 60Hz idle polling, persistent iframe + saved-game paths; wired into Gaming Core Certification.
7. CSS portrait default and optional landscape media query for tablets only, no forced rotation prompt.

## Unverified
- Visual review and actual iPhone Safari input latency at 60Hz, portrait thumb reach and notch/safe areas, 2048 playback FPS/stutters over 10+ minutes.
- Actual commercial Pokémon/Mario boot, MBC compatibility, SRAM persistence, and independent encrypted game save restore.
- Physical user acceptance on the specific revised Vercel preview, exact-head CI & preview build; don't call UI/performance FINAL before those checks.

## Next sequence
1. Exact-head Gaming Core Certification + Jhadina Web build pass; preserve PR DRAFT.
2. Preview-only Vercel READY deployment pinned to exact commit; obtain authorized temporary preview link without globally disabling preview protection.
3. On iPhone portrait: open preview, play 2048, press all 8 buttons rapidly, rotate and return, open library while game running, Save/Stop, resume, switch games, and inspect touch stuck/lag.
4. Import owner-held Pokémon/Mario via iPhone Files; confirm actual MBC, save-state + SRAM roundtrip; separately prove encrypted backup isolated restore.
5. If frame pacing is still poor, instrument frame time before touching WASM emulation speed and compare power-safe render paths in Safari. Do not claim solved 'lag' based only on code.
6. Attach user screenshots and physical latency acceptance, audit/review branch and merge only after gates.

## Privacy/rights
- Game Boy homebrew 2048 MIT license remains pinned. No copyrighted ROM binaries or private Drive file IDs may enter public branch/build. Owner-private Drive handoff holds metadata and private IDs.
- Related source: `packages/gaming-core/GAME_LIBRARY_1_DRIVE_PHONE_HANDOFF_2026-10-10.md`.
