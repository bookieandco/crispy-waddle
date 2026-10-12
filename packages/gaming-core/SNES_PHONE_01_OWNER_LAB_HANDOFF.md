# SNES-PHONE.1 — Jhadina private Super Nintendo cartridge lab
Date: 2026-10-11. Status: **code integrated on review branch; runtime deployment and physical iPhone acceptance NOT certified**.

## Source integration
- UI: `apps/jhadina-web/public/gaming/snes/index.html`.
- Owner-local cartridge admission: `public/gaming/snes/player.js`.
- Hub link: `src/app/gaming/page.tsx`.
- Anonymous GET/HEAD-only static shell/runtime asset allowlist: `src/lib/supabase/middleware.ts`.
- Operator-only pinned archive installer: `scripts/install-gameboy-emulatorjs.mjs`. Same archive as previous Game Boy candidate, now verifying that a SNES9x core is present.
- Test: `scripts/gaming-test-snes.mjs` and Gaming Core CI.

## Cartridge boundary
The owner-provided `Super Mario World (U) [!].zip` in the ChatGPT conversation has **not** been committed, uploaded to Vercel, copied to Google Drive, or published in the site. Browser accepts a *new* user-selection from iPhone Files: `.smc`, `.sfc` or one-cartridge ZIP, performs local size/directory validation and SHA-256 fingerprinting, and gives EmulatorJS a same-origin browser `blob:` reference. No app route accepts cartridge upload. A ROM is session-only in the new SNES UI: select it again after page reload. EmulatorJS may independently store saves in the browser; do not imply Drive backups or cross-device sync.

This is an owner-only, personal/noncommercial test of a separately licensed emulation core. A supplied ROM is **not** evidence of game copyright ownership or permission to redistribute.

## Host commissioning (not yet run)
1. Independently obtain the exact EmulatorJS v4.2.3 release archive at https://github.com/EmulatorJS/EmulatorJS/releases/tag/v4.2.3 . Review the project's/core license and notices (in particular Snes9x noncommercial restrictions). No external scripts, binaries or ROMs are auto-downloaded in Jhadina.
2. On the authorized build host, run `node scripts/install-gameboy-emulatorjs.mjs /absolute/path/to/4.2.3.7z`. SHA-256 of the archive must equal `07d451bc06fa3ad04ab30d9b94eb63ac34ad0babee52d60357b002bde8f3850b`. Script verifies an SNES9x core and stages the local JS/WASM/data plus `manifest.json`.
3. Make `apps/jhadina-web/public/vendor/emulatorjs/approved/` available in the deployed artifact. This is **not included in Git** and must be commissioned in the host's build/deployment system with license notices. A normal Vercel preview without this staging will show “Self-hosted SNES core is not installed”; that is intentional and truthful.
4. Verify HTTPS GET 200 of `/gaming/snes/index.html`, `/gaming/snes/player.js`, `/vendor/emulatorjs/approved/manifest.json` and the staged `data/loader.js`. Confirm manifest source/version/coreIds and loader SHA match; no unexpected redirects to login.
5. On iPhone Safari rotate landscape, open `/gaming/snes/index.html`, tap Choose cartridge, select the ZIP from Files, then tap Load. EmulatorJS's **own Play button** is an additional required tap to satisfy mobile media gesture policy.
6. Physically check SNES touch input D-pad, diagonals, A/B/X/Y, L/R, Start/Select; test a separate Bluetooth gamepad if present; save and restore a state across reload/re-import; test sleep/wake/orientation. The virtual SNES controller and save/load interface are from EmulatorJS and cannot be certified by static tests.
7. Use **Test speaker**: short 523 Hz Web Audio tone. Log whether it was actually audible. A requested or running AudioContext alone is NOT proof of audio; a successful tone alone is NOT proof that the emulator's worklet generates samples. If silent, retain the Safari audio blocker for hardware repair.

## Acceptance status
- Implemented: static landscape shell, immersive screen toggle, SNES core configuration, built-in virtual controller/Save State exposure, user-selected local ZIP or SMC/SFC admission, file SHA, pinned loader SHA verification, no automatic CDN or ROM delivery, static auth exemption, synthetic browser logic test.
- **Not proven:** deployed runtime assets, core start, game frames, on-device responsive SNES buttons, audio samples, speaker sound, save persistence after reload, Vercel preview availability, real iPhone evidence, legal game redistribution rights.
- Existing production gates G28/G42/G51/G52 and draft Game Core PR continue to require independent runtime/device evidence. Do not auto-merge or describe this as certified gameplay.

## Recommended next target
`SNES-PHONE.2`: commission audited self-hosted EmulatorJS assets on preview without checking any game ROM into Git, run synthetic homebrew smoke and real iPhone audio+controls acceptance, then fix observed defects before releasing wider.
