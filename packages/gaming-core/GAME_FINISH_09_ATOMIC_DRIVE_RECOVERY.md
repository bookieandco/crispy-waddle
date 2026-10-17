# GAME-FINISH.09 — Atomic Game Core backup recovery

## Scope delivered
- Game Boy lab restores verified encrypted archives in **one IndexedDB readwrite transaction**; any existing record, transaction abort or write failure rolls back the whole batch.
- Original imported CAS record revisions are preserved rather than reset to 1.
- Encrypted exports read one **consistent readonly IndexedDB snapshot**, not seven independent scans.
- New backup validation rejects nested ROM/BIOS/firmware byte buffers, known secret fields, malformed library payloads and empty save states. Regular ROM binaries are never included.
- Neon Run high-score records share the same IndexedDB store as Game Boy saves and are in the encrypted archive.
- Added synthetic transaction simulation suite and envelope regression cases to Gaming Core CI.

## Evidence boundaries
- The synthetic cloud canary in Google Drive has real upload/readback byte-hash evidence from GAME-FINISH.08; do not re-label that as user-save certification.
- This phase proves **software simulated atomic rollback**, not a real iOS Safari IndexedDB transaction. Live iPhone/physical-controller exercise, battery/eviction behavior, real game save callback, and authenticated Google Drive upload/restore still need physical evidence.
- No Supabase, paid host, emulator binary, proprietary ROM or firmware is required for these code-only safeguards.

## Recovery drill checklist
1. Use a locally generated encrypted backup in the Game Boy lab from a legally supplied game / original arcade score. Keep the passphrase separately.
2. Upload the file into [Jhadina Game Core Backups](https://drive.google.com/drive/folders/1mKUoNatRke0g9xgD_9hYX36NIHQy052y). Do not put the passphrase in Drive, screenshots or commits.
3. Independently download and compare SHA-256 of the encrypted file.
4. Open a fresh, isolated browser profile/device, choose **Restore encrypted backup** and enter the passphrase. The operation should fail as a whole if any record key exists.
5. Confirm restored library entries / Neon Run high score, re-import original ROM on the new device, prove real state restoration on the approved emulator, and capture only nonsecret evidence.
6. Fail or mark AUDIT/REPAIR for any missing receipt rather than asserting cloud backup is live.

## Next
- GAME-FINISH.10: production-style phone accessibility/controller checks, vetted browser emulator runtime commissioning and real saved-game restore.
- Independent merge and exact-head CI review, then real physical iPhone evidence. Hades and PatBoy remain host-only candidates until installed and assessed.
