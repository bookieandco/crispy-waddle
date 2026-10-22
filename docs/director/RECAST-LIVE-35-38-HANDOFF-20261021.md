# JH-DIRECTOR.RECAST.LIVE.35–.38 — read-only recovery and source-level rehearsal
Date: 2026-10-21. Draft PR #1432. No production or staging database changes.

## .35 — branch replay forensics
Connected Supabase branch inventory still reports Jhadina main as MIGRATIONS_FAILED. The historical source Workstation-input migration (20261004193000) is missing from the observed live schema and October 4–5 migration history. The exact failing SQL statement has NOT been established.
New dated read-only observation: docs/director/RECAST-READONLY-SCHEMA-SNAPSHOT-20261021.json.
New offline contract: scripts/director-recast-replay-forensics.py and its regression tests. A stored snapshot cannot be a future runtime readiness permit.
Supabase's official troubleshooting guide requires examining Branches > View logs, then the corresponding failing Postgres statement; do not mark history applied without confirming the actual schema: https://supabase.com/docs/guides/troubleshooting/branch-in-migrations-failed-status.
No history rewrite, branch reset, staging spend or DDL applied.

## .36 — append-only rejection and review renewal
The new effective-review resolver selects the unique latest review per kind. A later rejection, expiry, future-timestamp or tie prevents earlier approvals from authorizing the candidate. A subsequent independently reviewed new approval can supersede older entries. A duplicate receipt or truncated/altered history blocks the set.
Reader now orders owner/project/asset-bound records by created_at descending, caps history conservatively and verifies every stored JSON evidence seal; it cannot silently discard a compromised later revocation. Negative tests cover renewal, revocation, replay, ties, and evidence tampering.

## .37 — isolated-staging-only persistence adapter
A dependency-injected review insert seam accepts a canonical unpersisted manifest only when supplied independent reviewer verification, explicit operator write commissioning, healthy disposable branch proof and validated schema/RLS. It rejects the production project reference, unapproved writes and forged evidence.
The adapter is NOT connected to a database or public HTTP route. The tests use an injected fake sink; no live receipt was inserted and no render or publishing authority was created.

## .38 — real local decoder smoke
Added synthetic one-second MP4 media smoke that uses real ffmpeg and ffprobe binaries when available, along with a remuxed preview. Checks decoded duration, dimensions and preservation of decoded PCM samples; a sample with deliberately altered audio is rejected. Fixtures are generated in temporary local directories without network, GPU, provider calls or user footage.
A passing smoke does NOT certify a character swap, likeness rights, motion match, lip-sync timing, QC or physical iPhone acceptance.

## Operator-owned execution gates
First obtain the exact failed migration SQL and reconcile project migration history. A newly billable staging branch needs a quoted cost and explicit operator approval. Then rehearse the missing Workstation table and the reviewed Recast receipt proposal under service-only grants, tested RLS and immutable source lineage. Finally commission an approved, capped rendering worker with independently reviewed evidence, before/after QC and owner approval.
All source changes remain in draft PR #1432. No live Supabase write, production merge, public publishing or billable video generation was performed.
