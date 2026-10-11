# GAME-FINISH.17 — Sega Genesis browser bridge and encrypted saves
Date: 2026-10-10 (America/Los_Angeles)
Branch: `game-core-audit-repair`
Draft PR: https://github.com/bookieandco/crispy-waddle/pull/1200

## Completed code-only integration
- A new landscape-first Sega renderer slot (`#jgenesis-wasm`) coexists with the disabled initial screen, thumb-oriented Genesis D-pad, Start/Mode and A/B/C/X/Y/Z inputs. No Play button is active until source-pinned assets, a reviewed manifest and local ROM are validated.
- `runtime-loader.js`: enforces HTTPS, COOP/COEP isolation, WebGPU adapter, exact audited source commit, explicit operator/license approval flags, six same-origin artifact SHA-256 checks, and verifies imported cartridge bytes against saved ROM SHA-256 immediately before any Jgenesis launch.
- `sega-prepare-jgenesis-bridge.mjs`: source-level patch of **only** `jsgroth/jgenesis@220421984e710758cb691dcd1dd6a757ae9aca72`; changes four files (config.rs, lib.rs, js.rs, audio.rs) so the WASM exposes `request_open_verified_rom` (private bytes) and `request_genesis_input` (Genesis 3/6-button events). Do not substitute unmodified upstream binary; it does not implement this bridge.
- `sega-build-jgenesis-wasm.sh`: manually builds this patched pinned source using upstream nightly Rust + wasm-pack, stages wasm-bindgen JS/WASM and the reviewed audio/polyfill/owner-save JS in a **private** output directory, includes GPL license notice and hashes each exact artifact. It emits **unapproved** manifest; it deliberately does not copy into public assets or grant an approval.
- `vendor/js/ui.js`: integration of Jgenesis run/ROM lifecycle with the Jhadina landscape player. `vendor/js/idb.js`: per-cartridge SRAM persistence, no generic BIOS or firmware integration, serializes save writes.
- `sram.js`: Sega SRAM keyed to the complete cartridge digest and `gen-<24hex>` identifier, with SHA-256, limits, revision-aware conditional writes, tamper denial and explicit ROM-present requirement. Only this save format is accepted for Sega; no Sonic ROM bytes in saves.
- Existing `gameboy/backup.js` and `gameboy/storage.js` extended to include `gensram:` in AES-256-GCM/PBKDF2 encrypted archives and atomic save-only restores. ROM bytes remain excluded. Landscape Sega drawer offers **Encrypted backup**, **Restore encrypted saves** and the existing private Drive backups folder; uploads are manual and do not send Google OAuth to the browser.
- Exact approved static Sega assets only are listed in the public GET/HEAD middleware allowlist; unrelated game endpoints/APIs and private routes retain auth.
- Source/tests added for manifest denial, tampering, owner ROM-bound launch, SRAM revision/CAS, rollback, 6-button input and static HTML. CI also syntax checks the pinned source patch tool, build shell and Jgenesis JS bridge.

## Not yet commissioned (must not be called done)
**No compiled/pinned Jgenesis WASM artifact has been built or installed in this execution.** This environment has Node but lacks Rust and wasm-pack. `/gaming/sega/vendor/manifest.approved.json`, `pkg/jgenesis_web_bg.wasm`, `pkg/jgenesis_web.js`, `js/audio-processor.js` and `js/polyfill.js` are intentionally **absent** until reviewed binaries are staged. The Google Drive Sonic ZIP stays owner-private, never bundled into GitHub or deployed publicly.

**No real Sonic boot/audio/frames/touch/gamepad/SRAM save/restore on physical iPhone is certified** by code CI. `Sonic the Hedgehog` for Genesis does not have ordinary battery-backed save progress; working save states are a separate next milestone and must not be implied by SRAM support.

## Next explicit operator-run sequence
1. On an authorized Rust-capable host, create a pristine Jgenesis checkout at exact pinned commit, run `node scripts/sega-prepare-jgenesis-bridge.mjs /private/jgenesis`, then `bash scripts/sega-build-jgenesis-wasm.sh /private/jgenesis /private/empty-build-output`.
2. Independently review the four-file Rust source diff and compiled outputs, GPL notice, all six SHA hashes and verified filesystem origins. Only an approved deployment pipeline should produce `manifest.approved.json` (schema `jhadina.sega.jgenesis.approved.v1`, same pin and `bridgeApi`, `operatorApproved:true`, `licenseReviewed:true`, `files` exactly matching independently checked digests).
3. Stage approved, license-compliant JS/WASM/audio assets in `/gaming/sega/vendor` on an exact-head *preview only*. Never stage commercial ROM files. Check real HTTPS response headers, CORS/CORP, SAB, WebGPU and worklet module registration.
4. Import owner-held Sonic ZIP **locally on iPhone** from Files/Google Drive picker. Tap **Check Sega engine**; only a fully verified manifest permits **Play**. Capture real video/audio/input evidence, then separate SRAM-capable homebrew cartridge save/readback tests.
5. Build a separately reviewed portable emulated **save-state** feature for Sonic's non-SRAM progress, including private encrypted export/restore and same-ROM digest.
6. Obtain independent physical-device receipt and exact-head CI and deployment evidence, retain PR draft until acceptance and explicit merge approval.

Status: CODE-READY / BINARY-UNCOMMISSIONED / IPHONE-UNVERIFIED.
