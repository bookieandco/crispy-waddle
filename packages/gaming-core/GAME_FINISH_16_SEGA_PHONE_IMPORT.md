# Jhadina Sega / Mega Drive — GAME-FINISH.16 Handoff
Date: 2026-10-10 (America/Los_Angeles)
Repository: bookieandco/crispy-waddle
Branch: game-core-audit-repair
PR: https://github.com/bookieandco/crispy-waddle/pull/1200 (DRAFT)

## Owner cartridge inspection (authenticated Google Drive, not distributed)
- The owner uploaded `Sonic The Hedgehog (USA, Europe).zip` into personal Google Drive root.
- ZIP: 386,937 bytes, one deflate-compressed member named `Sonic The Hedgehog (USA, Europe).md`; extracted length 524,288 bytes.
- ZIP central-directory CRC: `f9394e97`; extracted byte checksum verified.
- ROM at offset 0x100 identifies SEGA MEGA DRIVE; domestic and international header titles identify SONIC THE HEDGEHOG.
- Inspection proves file structure and cartridge identification, **not copyright permission, emulator compatibility or game boot**.
- Keep the ZIP and its ROM strictly owner-private. No commercial ROM bytes, authenticated Drive links, download tokens or private file IDs belong in public GitHub source or PR comments.

## Sega code now staged
- `apps/jhadina-web/public/gaming/sega/rom-import.js`: source-only ZIP and cartridge admission; single .md/.gen/.bin, 64-entry ZIP cap, compressed/uncompressed size checks, path traversal denial, matching local/central filenames, CRC, Genesis header, SHA-256. Reject unsupported interleaved .smd.
- `apps/jhadina-web/public/gaming/sega/index.html` and `app.js`: portrait/landscape phone lab, local iPhone Files import, atomic IndexedDB Sega ROM/library records, safe idempotent reimport, missing-ROM-after-metadata-only-restore status. Touch controller layout is **disabled** until core readiness.
- `apps/jhadina-web/src/app/gaming/page.tsx`: discoverable Sega card linked from Gaming hub, openly marked runtime pending.
- Narrow GET/HEAD exception added for **exactly three Sega static paths** in Supabase middleware. No API, private route, credential, or other asset exception.
- `scripts/gaming-test-sega.mjs` uses a synthetic Mega Drive fixture; the Gaming Core Certification GitHub Actions workflow executes it. A real Sonic ROM is not added to source, tests, artifacts, or deployment.

## Live gates / next coding sequence
1. **SEGA-WASM.1** — pin GPLv3 Jgenesis browser build and verify source/license/attribution. Review compiled JS/WASM with cryptographic hashes and software supply chain. No automatic binary installation until reviewed.
2. **SEGA-WASM.2** — use a route-scoped WebGPU + COOP/COEP preflight; never apply COOP/COEP globally without testing Jhadina's auth, music and other apps. Safari 26 includes WebGPU API, but Jgenesis iPhone runtime compatibility remains unproven.
3. **SEGA-WASM.3** — same-origin binary loader and one-at-a-time import from existing IndexedDB; rehash before transfer. No Drive token in frontend and no server ROM endpoint.
4. **SEGA-INPUT.1** — phone landscape Genesis D-pad, Start and A/B/C, 6-button controls where appropriate, gamepad mapping and touchcancel handling, then actual input-latency evidence.
5. **SEGA-SAVE.1** — segregated per-cartridge SRAM/save states, revisions and ROM-free encrypted Drive backup, isolated restore and SHA receipts; note existing Game Boy backup intentionally excludes ROMs.
6. **SEGA-CERT.1** — exact-head GitHub CI and preview-only deployment; independently verify 60 Hz/pacing, audio, save/reload and Sonic boot on physical owner iPhone. An unverified code check is not a gameplay pass.
7. **SEGA-FINAL** — independent review, merge PR, production deployment only after license, device and data-restoration approvals. Never imply that an owner-uploaded ROM alone proves distribution rights.

Pending: final CI status after this sequence, reviewed Jgenesis WASM binary, actual Sega emulator execution, protected Vercel preview, iPhone controls and gameplay, real save/restore. Keep PR draft and production unchanged.
