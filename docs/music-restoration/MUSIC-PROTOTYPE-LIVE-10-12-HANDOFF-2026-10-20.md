# MUSIC-PROTOTYPE.LIVE.10–.12 — gated private iPhone release

**Code-only handoff, October 20 2026.** New work is stacked on draft PR #1428 → #1426 → #1422 → #1421. Neither the merged production source, Supabase database nor Vercel deployment is changed.

## .10 iPhone DAW acceptance
- Adds **Verify reopen** to DAW. It fetches a fresh owner-authenticated session, compares the entire saved edit document with stable object-key ordering, requires a persisted positive revision and matching case ID, then downloads a JSON software receipt.
- The receipt explicitly sets `physicalIphoneCertified=false` and `audioAuditionCertified=false`. It is not a substitute for hearing playback or independently checking the exported WAV.
- Existing waveform, playback, trimming, non-destructive edits, and CPU-only dry WAV export remain unchanged.
- To certify physical iPhone: owner signs in on portrait Safari, imports an actual owned WAV, selects a clip, auditions it, changes trim/gain/pan, saves, reloads the page, taps Verify reopen, bounces dry WAV and listens to the rendered file. Record file SHA-256 and output metadata independently. Test an unauthorized second account and expired signed source link.

## .11 Google Drive archival
- Existing private folder: https://drive.google.com/drive/folders/1KHrGGzQvuvwru0E0OwcKMbvoFHr4AyZr
- Adds a server-only Google OAuth refresh-token client and owner-approved `POST /api/music/restoration/archive` route. No browser key. Folder cannot be overwritten by browser input.
- Before upload, verifies registered source belongs to authenticated owner/case and has the exact expected byte length and SHA-256 from private Supabase Storage. Uploads into the fixed Drive folder, then re-downloads and hashes **Drive's actual bytes**, only returning `verified:true` if SHA and size match.
- Synchronous owner-triggered route intentionally caps files at 6 MiB to avoid timeouts or memory blowups. Larger files need a dedicated worker/queue; never falsely label a partial backup complete.
- No runtime OAuth has been configured yet, and the current Drive folder is empty. ChatGPT's Drive connector does not automatically grant the deployed web app OAuth access. Requires separately authorized offline OAuth credentials with permission to create/read items in this destination folder. Configure only server-side `MUSIC_GOOGLE_DRIVE_CLIENT_ID`, `MUSIC_GOOGLE_DRIVE_CLIENT_SECRET`, and `MUSIC_GOOGLE_DRIVE_REFRESH_TOKEN`. Never put any of these in `NEXT_PUBLIC_*`, source code, CI logs or issue bodies.
- No automatic sync, deletions, spending or Drive transfer is enabled by this PR. The button is opt-in. Large-file worker and systematic archive queue are a follow-up task.

## .12 release controls
- Adds owner-authenticated, no-store `GET /api/music/prototype/readiness` exposing booleans only, never secrets, URLs or private audio data. It checks privilege-client connectivity, DAW schema, private bucket, owner cases and Drive OAuth configuration. Unverified independent restore and device evidence remain explicitly false.
- Adds pure release admission logic: every evidence field must be true, including exact-head CI, isolated Postgres restore, private Storage object restore, DAW migration, owner-negative auth, private deployment, real WAV checksum, actual iPhone audition and edit/reopen, independently verified WAV export, and Google Drive independent readback.
- Migrations, Supabase recovery/backup, isolated staging and production deployment remain blocked without separate authorization, real staging credentials and test results.
- Vercel's normal preview must **not** borrow Swlc service-role credentials. Current source `music-private-runtime.ts` requires an isolated Supabase project and owner-protected preview for privileged access.
- The file behind the DAW `Verify reopen` button proves only software state persisted, not full on-phone acceptance.

## Required operator-owned evidence before release
1. Isolated restore of a post-recovery dated Swlc database backup; separate restoration test for Supabase Storage audio objects. Do not restore over the recovered production Swlc project.
2. Create/configure isolated staging Supabase and Vercel preview with only owner login, explicit preview OIDC/privileged client; run migration there first. Ensure owner-negative tests pass with a real second session.
3. Approve any production migration, merge or deployment independently; no action here constitutes that approval.
4. Import a permissioned WAV in portrait Safari, verify file hash and original sample dimensions, play, edit, save, reload and export dry WAV.
5. Grant runtime Google Drive offline OAuth with access to the private archive folder, run owner-approved archival of a small source, re-download Drive bytes and verify hash. A larger-file backup worker remains necessary for full-song archival.
6. Save the exact Vercel deployment SHA, all proofs, auth-negative outcomes, real iPhone evidence and rollback route into an immutable release record.

**Status:** source-only implementation. No real audio present in database; DAW session migration unapplied; archive empty; no preview release URL verified.
