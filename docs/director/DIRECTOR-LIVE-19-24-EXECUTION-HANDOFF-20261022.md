# DIRECTOR-LIVE.19–.24 — source implementation, private pilot and gated release handoff

2026-10-22 | canonical PR [#1473](https://github.com/bookieandco/crispy-waddle/pull/1473) | NO production SQL or migration-history edits, no billed worker, no release merge, no live publishing.

## .19 — browser failure is real unsafe optimistic unlock (source repaired)
- At prior SHA ad079813, Jhadina Private Mobile Browser QA failed waiting for `Preparing project` after navigating `/workstation?projectId=director-unowned-mobile-canary`. Earlier 34 shell links and Ask navigation passed. The user-supplied URL had initialized local `projectId` before server ownership was established, mounting editing panels optimistically.
- `apps/jhadina-web/src/app/workstation/page.tsx` initializes authorized `projectId` empty and invalidates old project/stage/selected-asset/revision upon query change. Only a successful authenticated timeline load populates it. If unauthenticated, error/pending state stays in `Preparing project` and editing panels do not mount.
- `apps/jhadina-web/scripts/qa-jhadina-mobile.mjs` asserts real local server timeline GET is HTTP 401 without owner auth; also enforces no stage nav/shelf and mobile geometry. This doesn't bypass the canonical authentication boundary.

## .20 — collision-aware source and ledger preflight
- `scripts/director-live-migration-admission.py` inventory enumerates canonical ten Director migration files, SHA-256 for each, nine known repository timestamp collision versions and remote-record status as either UNKNOWN, NOT_RECORDED or VERSION_RECORDED_PAYLOAD_UNVERIFIED. It never equates an applied version number with particular SQL content.
- `scripts/director-live-migration-admission-test.py` verifies 10 source files, collision presence, remote applied ambiguity, malformed ledger input and missing files. Wired into Director targeted CI.
- Preserves existing isolated Postgres 17 staging + pg_dump/pg_restore from `.13–.18`; previous exact-head CI passed, but that does NOT certify a real production backup or restoring Auth and Storage media.

## .21 — production migration remains blocked, reviewed forward-only only
- Live Supabase project `kqbkaozfjubkjevdfvic` has `MIGRATIONS_FAILED` branch status despite ACTIVE_HEALTHY preview/control plane. Prior SQL proved Director timeline, project-input and save RPC are absent and Oct 3–5 migration versions missing.
- CRITICAL unresolved: real independent database + Auth + Storage/media backup and restore, precise version-collision payload mapping, disk/capacity headroom. Do NOT invoke apply_migration, db push, database reset, migration repair, broad grants or DELETE until separately authorized after restore.
- Existing project memberships and schema grants are authoritative, and canonical service_role-only Director tables should not be accidentally broadened to anon/authenticated.

## .22 — WebKit guard tests prepared; physical Safari not certified
- Added `qa-director-mobile-webkit.mjs`: uses the actual WebKit engine at 390x844 and 320x568 touch/mobile emulation against built Next app; verifies HTTP 401 timeline read, no optimistic editing stages/approved asset shelf, no horizontal overflow, locked state after refresh and no page errors.
- CI installs Chromium and WebKit; runs existing full 34-link mobile navigation acceptance followed by Director-specific WebKit lock acceptance. Not a physical iPhone, Face ID enrollment, authentic owner token or real DB roundtrip test.
- Real iPhone + Face ID, timeline save/logout-login reopen, A/V sync, and owned video asset preview remain blocked by private deployment and production DB authorization.

## .23 — independently authored, private motion-design candidate
- Created entirely original local vector animation of fox lantern Lightkeeper over rainy city, 4 shots, 18 seconds, camera movement, glows, synthetic soundtrack authored locally, FFmpeg 24fps 480x854 H.264/AAC with +faststart.
- Output SHA256 `f50b309c6e1085bf9b29bd58d701991cb3fc450e037d2c14764b6cc4a0478d04`, 2,295,085 B, complete FFmpeg A/V stream decode clean. Local generating script `/mnt/data/director_live23_make.py` is an artifact of this work session, NOT a canonical licensed provider render.
- Private Drive upload, independently re-read metadata at `https://drive.google.com/file/d/1mBelD4wmyJIi6LdBx9Gn1ws5lrp4L1vO/view?usp=drivesdk`, folder `02-DIRECTOR-ASSETS`; storyboard at `https://drive.google.com/file/d/1ETfVKPCbYJ2MQSl_HZmojf-FlhhBQIRX/view?usp=drivesdk`.
- Rejected repurposing external clips from user's Pups source folder as copyright-cleared final footage without provenance. No claimed RunPod, Hunyuan, Recast or actual Director provider take.

## .24 — immutable private evidence and governed Social staging
- Reused `scripts/director-commission-18-media-qc.py` independent technical MP4 inspector, whose output permanently disclaims owner linkage, final creative/rights QC, real Safari, and publishing authority.
- `apps/jhadina-web/src/app/api/workstation/social-proposal/route.ts` now uses existing runtime OIDC service client rather than direct-only service key; no broader auth or new executor. New route unit tests assert unauthenticated 401, cross-owner 403, missing final-QC 409 and unavailable runtime 503, with zero publication calls.
- No Social post/proposal created, no scheduled provider dispatch, no licensed likeness or music consent falsely certified. User action to approve Social remains a separate, future step only after authentic final QC and asset admission.

## Acceptance gates and exact-next
1. Check latest-head CI for Private Mobile Browser QA (Chromium + WebKit), Director Targeted Tests, Media Production, JLLM, Launch and Web Typecheck. Any failures are blockers.
2. Create cryptographically checkable independent SWLC snapshot/restore receipt for DB+Auth and Storage/media; map timestamp collisions and prepare collision-free forward-only SQL plan.
3. Distinct owner approval to apply production schema and another for private deploy. Verify RLS negative tests, owner timeline roundtrip on iPhone, restore after logout/login, 9:16 native A/V.
4. For true cinematic producer acceptance: verify rights-cleared project-bound source/media, approved actual provider or explicitly authorized local worker, independent shot-level continuity/audio QC, final-master hash + project receipt.
5. Only then prepare the canonical Social proposal; never publish from a synthetic/technical pilot or implicit credentials.

**Status:** .19 fail-closed UI fix committed; .20 collision source gate committed; .21 production DDL deliberately BLOCKED; .22 WebKit emulation test committed but not real-iPhone certified; .23 new original 18-second pilot uploaded privately; .24 Social authority/tests committed but no publication.