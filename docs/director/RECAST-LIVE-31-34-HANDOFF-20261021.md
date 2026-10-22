# JH-DIRECTOR.RECAST.LIVE.31–.34 — migration forensics and source-level integrity

Date: October 21, 2026. Source branch of PR #1432. No live mutation, no worker invocation.

## .31 Supabase migration replay diagnosis — read-only

Connected Jhadina project `kqbkaozfjubkjevdfvic` was previously verified as ACTIVE_HEALTHY, but its branch inventory reports `MIGRATIONS_FAILED`. The current live database contains `jhadina_artifacts`, Director Cast, and membership tables, but **does not contain** `director_project_inputs` or `director_recast_review_receipts`. The live migration history lacks October 4–5 entries despite the Workstation inputs source migration `20261004193000_director_workstation_project_inputs.sql`.

An additional historical **August 7, 2026** Postgres log lookup surfaced two entries reporting `relation "supabase_migrations.schema_migrations" does not exist` at approximately 23:53 UTC. This is **not confirmed** as the failed preview-branch migration statement; the branch workflow's exact failed step is not yet evidenced. Do not repair or mark history from these snippets alone. The correct course is read-only failure-step extraction (branch workflow and exact SQL), migration-vs-schema comparison, then explicitly authorized isolated rehearsal. Do not create a branch or modify production schema/history without owner approval.

## .32 Recast evidence integrity repaired

Previously, the review-reader checked that an `evidence_sha256` string looked like a SHA-256, but did not recompute it. Now `recast-review-digest.ts` canonicalizes nested JSON objects deterministically and hashes actual payload bytes, independent of JSONB object-key ordering. The staged receipt generator and privileged reader use the same seal. Altered, unserializable, oversized or mismatched evidence is rejected **before** a receipt counts. Old fixture-only dummy seals were replaced in tests. A passing hash proves record consistency, not independent human review or consent.

## .33 Runtime storage errors classified

New `recast-schema-diagnostics.ts` distinguishes a genuinely missing relation from a permission/grant error and an unavailable service. This enriches the existing authenticated read-only Recast readiness API and keeps uploads blocked when project input storage is not readable. The API preserves **both** the schema-specific reasons and the independently required runtime/owner render-approval blockers; it never calls a worker. Do not propose a migration when `42501` indicates missing privileges; still investigate Supabase Data API service-role grants, and retain owner/project authorization on all paths.

## .34 Offline original-audio preservation test

New `services/replacement-service/recast_audio_integrity.py` checks separately SHA-pinned, approved local source/preview files from a constrained root, decodes each to bounded mono 16kHz PCM using `ffmpeg` with **no shell, network URL or GPU**, and compares decoded sample digests. A mismatch proves original audio was not exactly retained; a match alone does **not** prove lip-sync quality, lawful use or independent QC. No video was rendered, no actual owner footage was supplied, and the tool is not a production web endpoint. Paired negative tests cover changed audio, fake hashes, outside-root files, and missing audio.

## Validation and release prerequisites

Director targeted CI includes the evidence digest, storage diagnostics, privileged ledger, and local audio integrity tests. Independently review those exact-head results before source acceptance; other project CI jobs can differ.

Remaining prerequisites: exact failed branch migration SQL, owner-approved (and priced if billable) disposable Supabase rehearsal, canonical project-input table and audited review registry, server-side independent approvals for all four types, licensed preview compositor with separately approved capped compute, exact-head runtime and actual original-to-recast 30-second QC, and physical iPhone owner acceptance. PR remains draft; no production merge, migration, paid inference or publication.
