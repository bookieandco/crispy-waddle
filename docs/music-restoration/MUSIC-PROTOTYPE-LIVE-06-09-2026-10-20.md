# MUSIC-PROTOTYPE.LIVE.06–.09 — 2026-10-20

**Status: staged source implementation only. Draft PR #1428 stacked on #1426 → #1422 → #1421.** No merges, Supabase schema writes, Vercel runtime deployments, private uploads, or Google Drive file copies executed by this sequence.

## .06 — Release reconciliation

- GitHub `main` stayed at `2b8769b7604e24998713b43cbd874eed1eb5295a` at read-only snapshot.
- PRs #1421, #1422 and #1426 were still open, draft, `mergeable: true`, with stacked dependencies in that order.
- The previous source-only iPhone DAW PR #1426 at `feb2ec1772058689e5debc536e01e9abeed9cbac` passed 7 exact-head workflows, with Launch Gate still running on the earlier audit. Recheck at merge; green checks are not a runtime acceptance receipt.

## .07 — DAW migration security and live inventory

- Swlc `kqbkaozfjubkjevdfvic` accepts queries, not in recovery, `transaction_read_only=off`; **zero restoration cases** and `music_daw_sessions` absent. The existing `music_restoration_cases` primary key is text and owner FK is UUID.
- Existing music tables have FORCE RLS with no anon/authenticated direct INSERT. The `jhadina-music-restoration` bucket is private, permitted 500 MiB and audio MIME types.
- Hardened the *unapplied* `20261007194500_music_daw_portable_sessions.sql` to use `SECURITY DEFINER SET search_path = pg_catalog`, with EXECUTE only for service_role; removed deprecated `auth.role()` test which duplicated explicit function grant.
- Contract tests assert forced RLS, restricted public grants, ownership, revision fencing, and mutation idempotency.
- User screenshot displayed physical backup rows on 2026-10-20, but no independent recovery restore has been verified. Supabase DB backups do **not** include the audio bytes in Storage.
- **NOT DONE:** isolated staging database migration, actual owner+negative SQL RPC tests, and production migration. Do not execute the migration just because source tests pass.

## .08 — Private runtime authentication

- `music-private-runtime.ts` defaults to existing production OIDC-bound Supabase service proxy; it never sends a service key to the browser.
- A Vercel preview must point to a *different* Supabase project, must match a dedicated `MUSIC_PREVIEW_ISOLATED_PROJECT_REF`, the Vercel project ID and music-prototype branch, and requires a server-only staging role key.
- Swlc project ID in preview fails closed. This is a **source-only gate**; no new staging project was bought or created and no preview credential installed.
- Other existing music routes still require their existing privileged helper and should be end-to-end assessed on the selected deployment.

## .09 — Signed direct-to-private-Storage original WAV

- New authenticated `POST /api/music/restoration/direct-upload` actions: `ticket` and `finalize`.
- `ticket` verifies the logged-in user's Supabase claims, validates WAV filename, size (44 bytes–96 MiB), expected SHA-256, and issues a short-lived signed Storage token for a *server-generated owner/case/sha256 path*.
- iPhone browser computes hash, uploads <=6 MiB using SDK signed upload and larger files in 6 MiB TUS chunks to the direct Supabase Storage hostname; progress is shown. TUS retry obtains the current server offset before retrying, so a committed chunk cannot be replayed at a different offset.
- `finalize` retrieves the uploaded private object's signed read URL, streams the entire response through SHA-256 and byte-count verification, parses RIFF/WAV PCM 16/24/32-bit mono/stereo up to 96 kHz, and registers the owner-private source and case **only after verification succeeds**. No AI worker is necessary. No fake worker receipt or certified restoration.
- Files are immutable by source/path convention (upsert false); no automatic deletes on failures. Uploads that fail after storage but before case registration must be investigated as possible orphans.
- Client-side WAV hashing uses `file.arrayBuffer()` and will temporarily consume phone memory; full-song and Safari/device acceptance remain unverified. Backend verification uses streaming.
- The first version still caps direct WAVs at 96 MiB rather than the bucket's 500 MiB. Untrusted codecs, MP3/FLAC, and large WAV64 remain on the separately gated worker pipeline.
- Google Drive JHADINA-AUDIO-ARCHIVE exists and is private; **no runtime auto-sync implemented** in this sequence.

## Exact live acceptance to run after owner approval

1. Confirm a dated recoverable Supabase backup and independently export sample private Storage audio; rehearse restore in a disposable or isolated project.
2. Provision a separate owner-protected preview database and scoped server credentials *or* authorize an explicitly reviewed production launch, never expose service-role credentials in a public client.
3. Apply the reviewed DAW migration in isolated staging; verify RLS and RPC denial from anon/authenticated, replay and revision conflicts with owner and different-owner fixtures.
4. Run Vercel preview with correct claim-auth, isolation, private storage, and a direct WAV upload (preferably >6 MiB to exercise TUS), then inspect private artifact SHA and downloaded WAV dimensions.
5. On physical iPhone Safari: login, progress, playback, edit, save, reopen after reload, dry WAV export and owner-only negative test. Record immutable evidence from that exact deployed build before considering production merge.
6. Separately authorize Google Drive OAuth for a private worker and verify independent SHA-256 readback before enabling automated archival.

No external side-effect claims or live acceptance can be inferred from CI alone.
