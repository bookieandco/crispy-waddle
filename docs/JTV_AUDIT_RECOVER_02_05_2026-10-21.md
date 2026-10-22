# JTV-AUDIT.RECOVER.02–.05 — verified execution handoff (2026-10-21 PT)

## Scope and evidence hierarchy
This is the canonical **source/commissioning** handoff for the existing JhadinaTV package and Next.js Pages Router integration. It does not create a second TV stack, a provider, a public media relay, paid infrastructure, or a media license.

Baseline GitHub main reviewed: `04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61`. Merged TV PRs #1329/#1333/#1334 are preserved. Original stale PR #150 must not be merged.

## RECOVER.02 — owner identity
- Read-only query to canonical SWLC Supabase Auth confirms the designated sole owner's pre-existing account is email-verified, not banned, and has signed in. No password, passkey, login-link dispatch or session revocation was performed.
- Added Vercel **sensitive** environment key `JHADINA_TV_OWNER_AUTH_USER_ID` for production and preview, derived from the verified existing Auth record. No UUID or credential is committed.
- Existing `requireJtvOwner` compares a fresh Supabase `auth.getUser()` result with that exact server-side UUID; missing owner config fails 503, missing/invalid session 401, another account 403.
- Added `server-viewer.test.ts` and JhadinaTV PR CI coverage. These are offline tests, not real iPhone / passkey session acceptance.
- **Not certified:** deployed environment re-build and actual iPhone owner/nonowner login paths. Environment variable changes alone do not rewrite an existing Vercel deployment.

## RECOVER.03 — consumer-state migration
- Canonical Supabase Postgres responded to SQL with `pg_is_in_recovery() = false`.
- Applied original, pre-reviewed JTV owner-state SQL using Supabase migration API. Live migration history version: `20261022050023_jhadinatv_owner_consumer_state`.
- Verified `public.jtv_watchlist` and `public.jtv_playback_checkpoints` exist with RLS enabled and no current fixture rows.
- Verified authenticated SELECT+INSERT grants and anonymous SELECT denial for both tables. `public.jtv_record_checkpoint` is part of applied SQL and is `SECURITY INVOKER`.
- Renamed repository migration file to exactly match the now-applied **live version**. Removing its obsolete `20261016213000` filename avoids a future migration runner replaying a second `CREATE POLICY` against already-provisioned schema.
- **Not certified:** real two-authenticated-*test-account* RLS canary with owned JWTs, cross-account REST actions and physical cross-device Continue Watching. Existing `scripts/jtv-postmerge-rls-canary.mjs` remains the gated real integration test and requires user-provided existing test-user sessions and explicit test writes. Do not use the owner's personal account as a canary fixture.

## RECOVER.04 — media source commissioning status
- Vercel environment inspection showed no `JHADINA_TV_JELLYFIN_URL`, `JHADINA_TV_JELLYFIN_API_KEY`, `JHADINA_TV_JELLYFIN_USER_ID`, playback-right/evidence, or media-signing configuration.
- Only the **owner identity** key was added. The genuine HTTPS Jellyfin URL, server API key, authorized Jellyfin user, concrete media-right evidence, and permitted movie/live-channel IDs **do not exist in reviewed evidence**.
- `getJellyfinAdmissionStatus()` and signed-source handlers remain fail-closed. No guessed provider credentials, synthetic licenses or unauthorized stream URLs should be added.
- Owner-approved local M3U stays local to the browser and does not establish independent broadcaster rights or a server-backed, castable Jellyfin stream.

## RECOVER.05 — test status and live acceptance
- Previously merged JTV playback source PR #1334 at `781c6a8` had 8/8 green exact-head workflows, including JhadinaTV and Media Production Certification.
- This new branch requires **its own** current-head TV/security/typecheck/launch CI evidence. Prior green tests are historical only.
- Physically verified playback remains absent: authorized movie + permitted live channel, Safari audio/tap, seeking/rebuffering, 60-minute signed HLS renewal, iPhone background-resume, failed-source behavior, AirPlay/Google Cast hardware, subtitle/PiP, and production rollback.
- **No live media certification or production promotion**, and no automated device/broadcaster access can be claimed from a READY build.

## Ordered remaining commissioning
1. Run exact-head CI on this PR, review merge and verify protected deployment matches merged SHA; test real owner login and nonowner denial.
2. Run `scripts/jtv-postmerge-rls-canary.mjs` only with two existing authorized *test* JWTs and the explicit `JTV_CANARY_ALLOW_WRITES=YES` + `JTV_CANARY_TEST_USERS_ONLY=YES` gates; archive redacted real receipts and remove fixtures.
3. Owner commissions a real HTTPS Jellyfin instance or a permitted source. Set server-only signing key, credentials, origin, rights and evidence by secure environment entry, without publishing secrets.
4. Verify one permitted movie and one live channel including HLS manifest/segments and expired-token denial on the actual deployed origin.
5. Run 60-minute native Safari/device acceptance and Cast/AirPlay hardware trials, verify production health and preserve an exact-SHA rollback target.
6. Close issue #1335 only after all independently reproducible real-world acceptance receipts pass.

**Live status:** `NOT_CERTIFIED`. Complete only the evidenced source/schema/owner-environment work; the remaining gates depend on media sources and real-device sessions.
