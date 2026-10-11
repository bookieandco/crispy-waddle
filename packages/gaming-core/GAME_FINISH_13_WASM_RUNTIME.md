# GAME-FINISH.13 — Self-hosted playable Game Boy/GBC runtime

## Implementation
- Vendor `binji/binjgb` source at exactly `16621111ed0ee73bcc45c912a823bcebedcffc0f`, license MIT with retained upstream main LICENSE and GB Studio attribution. Original compiled JS Git SHA-1 `226bc2b9483a4ad3bf72b879287af09237f51ec1`; WebAssembly Git SHA-1 `03f903fe760110f9584b8487c8be955810373512`.
- Runtime is self-hosted in `/vendor/binjgb/approved/`; approximately 13.6 KB of JS and 88.3 KB of WASM, plus a customized MIT `jhadina-simple.js` and touch CSS.
- The Game Boy frame no longer needs the 304 MB EmulatorJS release. `scripts/install-gameboy-emulatorjs.mjs` remains an **uncommissioned optional installer**, not active player configuration.
- A nonce-and-same-origin approved ROM arrives via `postMessage` only after verifying user-imported ROM SHA-256 in parent. No ROM URLs or ROM bytes are exposed to an external service or in encrypted Drive backups.
- Touch D-pad, A/B, Start/Select and keyboard controls from binjgb. Browser Gamepad API maps standard controller axes/buttons where supported. Exposes explicit Save State and waits for local IndexedDB state receipt before Stop completes.
- Added `gbram:` battery-RAM records, also per-game keyed and SHA-256 verified, to the same revision-safe IndexedDB and encrypted backup allowlist. Crypto scheme/schema unchanged; import of older archives remains supported.
- Actual WASM smoke harness tests 2048.gb against the embedded emulator and verifies time advances, plus vendor SHA, license, and state bridge checks.

## Certification boundaries
- Green GitHub CI = local software/Node emulation proof, **not iPhone Safari certification**.
- Live HTTPS Vercel preview from exact Git commit, physical touch/gamepad, saved-state reload and authenticated Google Drive backup/readback/isolated restore require further commissioning.
- No new server, paid subscription, Supabase, BIOS or commercial Nintendo cartridge data was used.

## Next operator acceptance
1. Open deployed `/gaming/gameboy/index.html` on iPhone.
2. Download the MIT 2048.gb sample and import it locally.
3. Tap Play. Confirm board renders, D-pad moves tiles and screen responds in landscape. Test connected gamepad separately.
4. Tap **Save State**; stop and restart. Verify state restored. Export encrypted backup, perform isolated restore and prove same state.
5. Record device outcome in `/gaming/diagnostics/index.html` and retain nonsecret receipts in Drive.

## Final UX and core restore regression
- **Play free 2048 now** imports the pinned, header-verified bundled MIT 2048 cartridge into the same revision-safe IndexedDB library and starts it on a genuine user action; manual import remains available.
- Headless WASM smoke now also writes and reloads an actual binjgb state file and enforces the 8 MB save bounds. This is distinct from browser IndexedDB and iPhone acceptance.
