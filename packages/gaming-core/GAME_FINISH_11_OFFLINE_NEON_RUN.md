# GAME-FINISH.11 — Neon Run iPhone offline shell and installation gate

## Coding delivered
- A dedicated service worker at `/gaming/neon-run/sw.js`, scoped to **only** `/gaming/neon-run/`. It caches six approved static **public** assets: index.html, engine.js, app.js, offline.js, manifest.webmanifest, icon.svg.
- It never intercepts Game Boy cartridges, IndexedDB APIs, local saved scores, encrypted backups, Google Drive, other Jhadina worlds or cross-origin URLs. Cross-origin URLs, POST, unknown paths and URLs with query strings are ignored.
- The installer only claims an offline copy after the expected six files appear in browser Cache Storage. An installation error fails closed; cached files are subject to Safari eviction.
- `manifest.webmanifest` enables a landscape-preferred home-screen shortcut where supported. iPhone Safari can use Share > Add to Home Screen; platform behavior requires physical testing.
- Node CI simulates service-worker installation, activation, an offline reload and strict non-interference. It does **not** certify iPhone Safari. No third-party game/ROM/BIOS binaries are installed or bundled.

## Tests / exact-head evidence
- `node scripts/gaming-test-offline.mjs` verifies a deterministic Cache Storage worker harness. Existing GAME-FINISH.01-.10 checks remain mandatory.
- Use GitHub Actions Gaming Core Certification to prove the exact commit. Check Jhadina Launch Gate, Web Deploy Conformance, UX Final, and JLLM Runtime separately before merge.
- Homebase, Vercel production deployment, real phone Safari, paired gamepad, and real encrypted Google Drive restore still require external commissioning.

## Phone drill once deployed
1. Load `/gaming/neon-run/index.html` while online on the *deployed HTTPS domain*. Wait until the game says **Offline-ready**.
2. In iPhone Safari, Share > Add to Home Screen. Launch the game online at least once.
3. Use Airplane Mode, fully close and reopen the game from the same origin. Prove canvas controls and gameplay load; record failure if browser evicted cache.
4. Play a round, verify score persists after browser restart, then manually export encrypted progress from the linked Game Boy lab and back it up to the existing Jhadina Game Core Backups Google Drive folder.
5. Use `/gaming/diagnostics/index.html` to generate a nonsecret physical receipt. Do not claim emulator gameplay from an original arcade test.

## Gates
- **Code CI pass** is not browser/iPhone acceptance.
- **SW cache ready** is not indefinite offline persistence or encrypted cloud restore.
- **PatBoy/Hades** remain desktop-only candidates requiring native host verification.
