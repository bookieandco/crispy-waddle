# DIRECTOR-COMMISSION.14–.18 — Commissioning source, recovery proof and release boundaries

Date: 2026-10-22, America/Los_Angeles. [PR #1473](https://github.com/bookieandco/crispy-waddle/pull/1473). No production DDL, new billable compute, protected/private deploy, merge to main, publication or paid Social/Ads.

## .14 — Reconciled new main without overwriting Director work

- Inspected compare merge-base `04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61`, newer `main` `dbb6b99c970451f89de2ebe7cddf9fdeccb113c2`, and Director branch `b56d12a28662862c26bcb75bfffdae54173ca9ed`.
- Main was 21 commits ahead, with 28 changed paths. Director source was 71 commits ahead of merge-base, with 52 changed paths. **No changed-path collisions.**
- Created GitHub true two-parent merge `7359c8bdfe4c4815d66bd23158a13c31a3292ce0` by copying each exact main blob SHA onto the canonical Director tree; Git ref update used expected-head lease and no force.
- Verified Director is **0 behind main** immediately after merge. Both histories preserved. Main was not updated; branch still draft, deployment not authorized.
- New exact-head CI MUST be checked after the subsequent commissioning fixes; historical pre-merge green workflows are not latest-head evidence.

## .15 — Director durable schema forensic + isolated backup/restore

- Supabase project `kqbkaozfjubkjevdfvic` is accepting read-only SQL, with no applied migration history in the 2026-10-03–2026-10-05 window. `public.director_workstation_timelines`, `public.director_project_inputs`, and `save_director_workstation_timeline` are still absent; earlier comprehensive audit found screenplay, Watch and final-QC stores absent. Control-plane `main` status historically `MIGRATIONS_FAILED`. Prior read-only ledger count 372, size approximately 1,340 MB.
- Source inventory found **nine version collisions**: `20260902013135`, `20260920190000`, `20260920200000`, `20260920210000`, `20261001120000`, `20261001163000`, `20261003221000`, `20261005023000`, `20261005024500`. The latter three collide with Director source files in our ten-file staged replay. No blind `supabase db push`, `migration repair`, or history reset.
- Updated `scripts/director-commission-13-staging.sh`: disposable PostgreSQL 17 with `--network none`; canonical source replay, strict GRANT/RLS/RPC tests, owner/viewer/nonmember and revision fencing; an isolated `pg_dump -Fc` then independent `pg_restore` into another database, verification of timeline/event/membership fingerprint and denied anonymous access after restore.
- **Crucial distinction:** successful synthetic restore proves the fixture/archive code only. No real SWLC full database backup or independently restored live data, Auth state or Storage media has been proven. Real backup remains a hard production admission requirement. CI is the authority for this newly added test.

## .16 — Production repair review package; live apply BLOCKED

- Exact safe source files: `20261003221000_director_durable_workstation_timeline.sql`, `20261004193000_director_workstation_project_inputs.sql`, `20261004210000_director_screenplay_ingest_proposals.sql`, `20261004221000_director_screenplay_blueprints.sql`, `20261004224500_director_watch_jobs.sql`, `20261004231500_director_watch_sources_idle_scheduler.sql`, `20261005000500_director_take_qc_watch_jobs.sql`, `20261005020000_director_project_final_qc_evidence.sql`, `20261005023000_director_watch_commissioning_receipts.sql`, `20261005024500_director_business_canary_receipts.sql`.
- Recommended recovery: independently restorable full DB/Auth/Storage snapshot; disambiguate all conflicting timestamp pairs and historical applied entries; produce a reviewed forward-only collision-free migration and rollback plan, with role grants, RLS policies, function execute ACLs, schema cache and append-only events inspected before and after.
- **No live DDL or paid staging branch** on this sequence. Production DDL, production deploy, and spending need distinct owner authorization after backup/restore receipt. Reuse existing 16 project membership rows; do not reset or recreate owner identities.

## .17 — Mobile workstation source and simulated-browser evidence

- Merged up-to-date main's login/callback, passkey, Ask navigation and mobile Chromium harness into the Director branch.
- Updated canonical `/api/workstation/projects`, `/api/workstation/timeline` and `/api/workstation/timeline/command` routes to use `await createRuntimeServiceRoleClient()`. This reuses the existing production Vercel OIDC proxy, including current project role authority; no public or generic scheduler authority was added.
- Updated timeline and command unit mocks; targeted Director CI explicitly includes these tests.
- Extended the existing `qa-jhadina-mobile.mjs` for 390px and 320px owner-unverified Director navigation: page loads without horizontal overflow; owner-scoped editing stages and approved asset shelf must NOT appear without authenticated owner state.
- This is Chromium local-bundle QA with a loopback-only smoke header. It does NOT certify Face ID, physical Safari, remote protected preview, Supabase login, or saved timeline readback. Those depend on approved deployment and live schema.

## .18 — Original local film technical QC only

- Preserved original, locally generated **The Lightkeeper** animated 12.000s portrait test pilot, MP4 (H.264 480×854, 24fps; AAC stereo), original soundtrack, 518,618 bytes.
- Original MP4 SHA-256: `a4a9e21ce25a2f15392dfbdcdcb474643aa6469b35b1a7a1e50813bd5bd15052`.
- Re-verified live local `ffprobe` and full `ffmpeg -xerror` A/V stream decode: no error. Saved a technical-only QC JSON outside GitHub source for handoff. Added `scripts/director-commission-18-media-qc.py` with SHA-bound, codec, duration, portrait, complete-stream validation and fail-closed results; CI synthetic tests include invalid SHA/duration/absent file.
- **Not a genuine owner-linked Supabase project, not a real Hunyuan/Recast or provider take, not independently assessed frame-level continuity, not music/likeness clearance, not creative final-QC and not a publishing master.**
- Next fully governed pilot: owner-approved original asset and production reference -> real persisted project -> approved take -> FFmpeg worker -> independent image/audio/rights/final QC -> durable receipt and private iPhone readback -> separately authorized Social proposal.

## Current release gate and ordered remaining actions

1. Exact-head CI success for Director, mobile Chromium, web typecheck, JLLM, media and launch gates; if failing, fix the exact log issue before readiness.
2. Full SWLC snapshot + independently restored DB/roles/Auth/Storage/media proofs and capacity headroom; disambiguated migration ledger and exact forward-only migration file. **BLOCKED** until independently available and reviewed.
3. Separate written/interaction approval to apply production DDL; no silent staging cost. Verify affected owners (including denial across projects), journal idempotency, hash readback, RLS & anon/auth negative probes.
4. Separate private Vercel deploy authorization, authentic user login/passkey/iPhone Safari audit, 9:16 synchronized playback, timeline edit/logout/login/readback, asset validity.
5. Separate rendering/provider (and any paid GPU) authorization for owner project; verify full quality, cost, rights and canonical Social publish approval.

**Status:** .14 fully completed. .15 synthetic restore source prepared and CI-tested once green, but live backup verification blocked. .16 plan only and production DDL blocked. .17 source and automated emulated mobile tests, live iPhone blocked. .18 real local original technical MP4 verified, owner-approved film commissioning blocked. No assertion of production readiness.
