# MUSIC-COMMISSION.31–.35 — owner's private uploads, byte integrity and honest readiness

**Status:** GitHub source-only branch stacked on `feat/music-security-activation-26-30-20261009` (PR #1201). Production launch is NOT certified.

## Verified parent
PR #1201 exact head `606a6f79bbfa3412a2d42db1e704d82481c24c17` completed 8/8 GitHub workflows. The SWLC project previously returned PostgreSQL SQLSTATE `57P03`, and the P0 disk-capacity incident is tracked in issue #1110. No new DB, storage, payments or native iPhone live deployments were made.

## This branch
1. **31: owner's private-upload inventory.** Authenticated `GET /api/music/owned/uploads` lists at most 100 objects in the caller's own `music-owned/<auth.uid()>/` folder. Normalizer returns a bounded filename-ID, type, optional size and timestamp; no storage path, download URL or credentials. All entries are labeled `awaiting_independent_review`, never licensed. The Music phone UI has *Show my uploads*, with a refresh after successful upload.
2. **32: independent bytes.** `planVerifiedOwnedAudioAdmission` now requires the actual independently downloaded private-object bytes, matches the exact length and computes SHA-256 locally with constant-time digest comparison. Source/asset identities also incorporate the specific independently reviewed rights grant and track/object identity, preventing same-byte recordings licensed under different evidence from overwriting a prior approval. A manifest or user's original checkbox is **not** accepted as proof of uploaded bytes. Source plans remain unapplied until independent reviewer/operator approval, including pinned Storage origin. Regression tests cover mismatch and changed bytes.
3. **33: truthful readiness.** `GET /api/music/readiness` requires an actual rights-scoped candidate playback ticket for one of the first 50 user tracks, using user-session RLS and signed owned-file ticket resolution. A source record alone does not satisfy admission. Exposed status remains only `environment_ready_for_playback_drill`, explicitly **not** playback certification. Negative tests cover authorized sources without assets. Because the catalog sample is bounded, a false negative is possible when the sole playable track is outside the first 50.
4. **34: isolate admission identities.** Content hash alone is not a unique rights grant or track-asset identity. Deterministic keys now partition distinct tracks and independent license evidence; duplicate audio cannot silently rewrite another track or a separately approved source. **Freeze live dependencies:** No capability to sign remote services, publish audio, or grant rights was added. No privileged service-role credential is exposed.
5. **35: execution sequence.** Source CI → reviewed merge/approval → owner-controlled SWLC disk recovery (#1110) → read-only RLS policy audit → independent two-user read + staging write denial → private bucket config and actual audio SHA-256 readback → iPhone AirPlay/Bluetooth/lock-screen/background audio proof → explicit operator certification.

## Important remaining gaps
- The live source rights workflow still needs a secure operator-only persistence adapter; the current reviewed admission plan does not write any approved music assets to SWLC.
- The Music iOS native controller is built but still needs a genuine logged-in mobile session/ticket client and device testing; Green iOS simulator compile tests are not proof of usable native playback.
- Spotify OAuth grants metadata import only, not copyrighted audio access.
- Supabase database is not certified writable or restored; migrations and Storage policy remain **unapplied**.
- Playlist/import/library code must be smoke tested after deploying an approved exact commit, including under two real auth accounts.
- Actual launch requires proof of RLS, genuine audio, backup, licensed grants, expiration/renewal and device audio.

## Launch gate
Keep PR draft until exact-head checks pass. Even a green PR cannot authorize production, substitute an entitlement, resolve the disk incident or permit billable infrastructure changes by itself.
