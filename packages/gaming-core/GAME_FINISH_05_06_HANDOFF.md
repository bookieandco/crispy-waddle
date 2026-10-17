# GAME-FINISH.05-.06 — Durable local gaming and Game Boy phone lab

Branch: `game-core-audit-repair`. This adds:
1. `gaming-durable.ts`: IndexedDB compare-and-swap library/save/history/observation/route records with Memory test backend.
2. `gameboy-cartridge-vault.ts`: explicitly file-selected `.gb/.gbc`, SHA-256 verified ROM bytes and versioned saved-state bytes in gaming record storage.
3. `apps/jhadina-web/public/gaming/gameboy/index.html`: responsive landscape phone launcher, local ROM import, IndexedDB, player iframe.
4. `player.html`: same-origin nonce-checked transferable ROM bytes, self-hosted EmulatorJS, SHA-256 loader manifest gate, captured-save callback.

## Important limits
- The repository DOES NOT currently contain any approved EmulatorJS WASM/binary/data assets, so the page fails closed until installed.
- User must explicitly choose a legally possessed game. No ROM/BIOS download or prebundling.
- The runtime asset manifest is deliberately absent pending a reviewed, pinned version/source and independently checked hashes.
- A passing unit test does not prove iOS Safari input, physical GameSir controller, audio, video, or actual game state compatibility.
- EmulatorJS browser APIs and save-state events require a real device/browser test; only its published embedding/options APIs guide this integration.
- IndexedDB is local and may be evicted; `navigator.storage.persist()` is best-effort, not a backup. Isolated restore and export need a later phase.
- `gameboy` local launcher is deliberately a first playable *integration candidate*; not G51 physical certification.
- An approved manifest must be served at `/vendor/emulatorjs/approved/manifest.json` with
  `{"schema":"jhadina.gaming.emulatorjs.approved.v1","dataPath":"/vendor/emulatorjs/approved/data/","coreIds":["gb"],"loaderSha256":"<actual reviewed 64-digit hex SHA-256>"}`.
  The approved `loader.js` and WASM/core dependencies must be deployed under that data path.
- No external CDN fallback. The iframe restricts fetches/connect to same origin and local blob URLs.

## Next
1. Exact-head Gaming Core CI, broader app build and one browser emulator loading test.
2. Pin, audit, review and provision EmulatorJS local distribution; verify manifest SHA against actual bytes.
3. Test a lawful homebrew cartridge and real state round-trip on an iPhone, including restart and airplane mode.
4. Follow with GAME-FINISH.07 host integration and .08 full UI; G51/G52 physical evidence remains pending.
