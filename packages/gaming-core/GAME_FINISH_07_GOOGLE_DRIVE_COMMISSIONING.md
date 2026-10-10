# GAME-FINISH.07 — EmulatorJS operator commissioning + Google Drive

## Verified upstream distribution
- Pinned GitHub release: https://github.com/EmulatorJS/EmulatorJS/releases/tag/v4.2.3
- Archive: `4.2.3.7z`, reported 303,554,683 bytes.
- SHA-256 published in GitHub release metadata: `07d451bc06fa3ad04ab30d9b94eb63ac34ad0babee52d60357b002bde8f3850b`.
- The operator must review the license, provenance, security, and compatibility before installation.
- Never source ROMs, BIOS, firmware, or game content automatically.

## Installation on an authorized host
1. Independently retrieve the upstream archive and review license. Ensure sufficient local disk space (unpacked cores are substantially larger than the archive).
2. Have Node 20+, and `7z` or `7zz` installed.
3. Run `node scripts/install-gameboy-emulatorjs.mjs /path/to/4.2.3.7z` from the repo root.
4. Confirm `apps/jhadina-web/public/vendor/emulatorjs/approved/manifest.json` and `data/loader.js` exist.
5. Record actual SHA-256 of the loader and independent hashes of runtime core/WASM files and verify client loads. This script verifies the official archive SHA and loader but does not inspect or approve all other JS/WASM files individually.
6. Do not commit `vendor/emulatorjs/approved/` binaries to the source repository. Provision to the deployed Next.js web asset tree as an explicit operator action; a different Vercel deployment will not magically inherit assets from a separate computer.
7. Test one legally held homebrew cartridge, controller, phone audio/video, offline behavior and real save/restore. Keep G51/G52 physical certification blocked until real receipts exist.

## Google Drive
Google Drive is **backup/recovery**, not emulator compute. There is no verified gaming-specific Drive folder or live machine OAuth / readback receipt yet. The phone lab exports an encrypted, digest-checked portable save/library manifest without ROM bytes by default. The user may upload the resulting file into their private Drive as a first step, and download/import when restoring. Automated uploads require an explicitly authorized cloud OAuth workflow on the actual host and independently verified upload/download/restore receipts; mark AUDIT/REPAIR until completed.

Pass condition: verified encrypted export -> Drive upload -> independent Drive download -> isolated restore -> exact digest match; no ROM or save confusion. Do not put plaintext save data or Google tokens in logs, PRs or GitHub artifacts.

## Connected Drive destination (verified 2026-10-10)
- Folder: [Jhadina Game Core Backups](https://drive.google.com/drive/folders/1mKUoNatRke0g9xgD_9hYX36NIHQy052y)
- Confirmed Google Drive folder ID: `1mKUoNatRke0g9xgD_9hYX36NIHQy052y`.
- No game backup has yet been uploaded, read back or restored from Drive.
- Phone UI now exports/imports `jhadina.gaming.encrypted-save-backup.v1` using PBKDF2-SHA256 (310k rounds), random 16-byte salt, AES-256-GCM random nonce and ciphertext SHA-256. It excludes ROM bytes, game binaries and OAuth credentials.
- Upload the encrypted file manually through Google Drive until a host-authorized OAuth sync and verified readback are commissioned. Preserve the passphrase separately; Jhadina cannot recover it.
- A local restore only occurs after decrypt/authentication and save-state hashes pass; it refuses collisions with existing local records. Isolated full restore and a real provider round trip remain unverified.
