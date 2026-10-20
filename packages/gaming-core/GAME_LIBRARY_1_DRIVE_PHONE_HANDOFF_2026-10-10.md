# GAME-LIBRARY.1 — Private Google Drive GB inventory, persistent emulator and library handoff
Date: 2026-10-10 (user local)
Repository: bookieandco/crispy-waddle
Branch: game-core-audit-repair
PR: https://github.com/bookieandco/crispy-waddle/pull/1200

## Request and owner evidence
- User confirmed physical iPhone Safari Game Boy player works after repairing startup-order and rewind memory crash at f66873be84449fc53ed640976394a6076bb43ca1.
- User said two *.gb files were uploaded to Google Drive and supplied a screenshot of Drive search and a third-party ROM listing URL.
- The Drive connector **verified** two owner-only binary files, now organized in an owner-private 'Jhadina Game Library - Private Cartridges' folder:
  - Super Mario Land (World) (Rev 1).gb — 65,536 bytes; Drive ID [private Drive ID recorded in owner-only Drive handoff].
  - Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb — 1,048,576 bytes; Drive ID [private Drive ID recorded in owner-only Drive handoff].
- Both file permissions showed only the owner and shared=false. File metadata does NOT establish copyright licensing, exact ROM hash, playable MBC support, battery-backed persistence, or right to publish files.
- The Pokémon file was originally named *.gb 4 and was **renamed metadata-only** to *.gb. Bytes were not changed.
- Google Drive private files were moved metadata-only from My Drive root into a dedicated owner-private 'Jhadina Game Library - Private Cartridges' folder, separate from the 'Jhadina Game Core Backups' folder (which holds handoff/backup records). No ROM bytes changed, shared=false on both files and folder.

## Current architecture: no ROM redistribution
- Phone displays two metadata-only owner catalog cards: Pokémon Red and Super Mario Land. Generic locally installed titles (e.g. MIT 2048) are added automatically based on IndexedDB library records.
- Each owner card remains 'Not installed' until the user chooses the corresponding *.gb with the iPhone Files picker; Jhadina does NOT serve, mirror, fetch or index the private ROM bytes on the public app or GitHub branch.
- Game Boy WebAssembly iframe sits above the library and stays mounted while the owner browses/chooses games. Switching titles asks the running emulator to save first; the ROM+state load/save messages are pinned to the **activeGameId** rather than the newly selected title, preventing misattribution and cross-game save corruption.
- iOS background/browser navigation may pause the emulation. 'Keep open' means remain on the library/playing page while browsing the game catalog, not a guarantee of background execution.
- Continue using the real GB/GBC emulator already tested with MIT 2048. Pokémon and Mario are **not yet individually certified**; their cartridge input/RTC/save behaviors need test with lawfully held owner files.

## Code-level guardrails
- No private Drive IDs or ROM bytes may appear in compiled public HTML/JS.
- No automatic third-party copyrighted ROM downloads. Owner-supplied files must stay local to IndexedDB, with encrypted backup export that explicitly excludes ROM bytes.
- Save/Stop and switch acknowledge state writes before switching emulator frames. Errors must not destroy an active game.
- Library file naming is metadata-only; not a rights certification.

## Validation and blockers
- Run Gaming Core Certification including scripts/gaming-test-library.mjs and existing signed homebrew, zip-import, startup/savestate, and storage tests.
- Verify all exact-commit GitHub workflows; deploy preview-only exact head to Vercel and confirm READY and access link. PR remains DRAFT and production unchanged until review.
- Owner must use iPhone Files provider to select a private Google Drive file for each card. If Drive is unavailable in Files, download a copy from Drive to Files first. Do not ask owner to expose a public Drive sharing link.
- Physical test: load each cartridge, observe actual gameplay, save, Stop, reload, resume, switch games while running without save-state mix-up, encrypted export and independent isolated restore. Test Pokémon battery-backed RAM separately, not just emulator snapshot.
- Do not treat the linked romsgames.net listing as a verified source of redistribution rights or automatically import ROM content from it.

## Next sequence
GAME-LIBRARY.2: cert and phone pilot from exact deployment.
GAME-LIBRARY.3: local sorting/search, portable library metadata export/import (ROM-excluded).
GAME-LIBRARY.4: owner-authorized Drive backup restore of saves, true cloud roundtrip receipts.
GAME-LIBRARY.5: optional consent-based Google Drive picker with client-side OAuth, no Supabase dependency for local player.
GAME-LIBRARY.FINAL: copyright/source provenance review, physical iPhone game+save certification, PR merge, production release.

## Source privacy note
This GitHub file is public. Private Drive file IDs and permissions stay in the owner-only Google Drive handoff, not in public repository source, compiled assets or deployment metadata.

## Verification update
- Gaming Core Certification for source implementation commit `10e54cc27b3176a91d1ea322140cb60132bbd7da`: **SUCCESS**, including `scripts/gaming-test-library.mjs`, exact private-Drive catalog hints and the existing real-WASM/2048 ZIP and storage checks.
- Private Google Drive readback confirmed the folder contains exactly the two `.gb` titles at 65,536 and 1,048,576 bytes respectively, both shared=false. No ROMs were copied to public deployments.
- Owner-only complete handoff document: https://docs.google.com/document/d/1mNd1rdogawNJ6sV3H87iZDNCObYr_Ba8Dj1sVeRUff8/edit
