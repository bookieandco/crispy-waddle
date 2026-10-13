# JHADINA SOCIAL-ID.25 — Trusted weekly operations read model and exact receipt lineage
**As of 2026-10-12, America/Los_Angeles.** Stacked on draft [PR #1235](https://github.com/bookieandco/crispy-waddle/pull/1235), SHA `d64d437fdbd21c8d2a90114a95b7853a85458153`. Main unchanged.

## Goal
Make the operations phone UI's previously-proposed READ_ONLY_EVIDENCE projection depend on a single server-authenticated owner, actual canonical weekly batch, currently effective account identities, non-executable child outbox audit, and **exact** matching receipt records. Absence/unavailable data is not a clean empty queue. Source-only; not yet connected to a production route.

## Implementation
- `verified-social-operations-read.ts`: `loadVerifiedSocialOperations` obtains verified owner+session once, loads the latest canonical batch selection only from an authenticated repository, re-runs .21 batch recovery with live packet+identity version checks, runs .23 read-only audit against that same parent receipt, reads independently authenticated exact owner-scoped receipts, verifies batch/report/receipt consistency, and projects .24 dashboard model. Any missing batch, owner mismatches, stale current identities, DB failure or inconsistent record aborts instead of simulating zero. No capability to write or retry.
- `supabase-weekly-operations-readers.ts`: **explicit commissioned:false** adapter to *proposed* `jhadina_social_weekly_child_batches_v1` plus existing `jhadina_social_approval_receipts`. The batch decoder requires all no-execution flags and owner/packet/receipt coherence. Receipt reader derives the correct action_id, capability and composite/child fingerprints from the recovered batch; rejects foreign owner, forged fingerprint/type, duplicate ids, and a parent receipt that is not genuinely consumed. Only matching read-only rows are counted; missing parent receipt fails closed. Owner scope uses query predicates **in addition to** required DB RLS.
- Tests: owner/session isolation, missing/latest selector, invalid batch, stale .21 identity, report mismatch, foreign receipt, missing/uncertain parent, uncommissioned DB, and approved-vs-consumed parent status.

## Security boundaries
This milestone does **not** connect `/api/social/operations` to the proposed database. It must continue to show NOT_COMMISSIONED/Unknown (or 503 with a premature flag), because there is no proved canonical weekly packet storage or true .21/.22 atomic SQL and independent restore. An environment variable alone is not commissioning evidence, and no server path enables this adapter.

No database migration, DDL, external publish/comment/spend, auto-retry, owner phone approval, actual provider receipt certification, or PR merge. Source test fixtures and mocks do not certify SQL ACID semantics or delivery outcomes.

## Audit/repair and next sequence
- `SOCIAL-ID.16` database/RLS/restore: [issue #1211](https://github.com/bookieandco/crispy-waddle/issues/1211).
- `SOCIAL-ID.22` atomic child approval/outbox/dispatch: [issue #1222](https://github.com/bookieandco/crispy-waddle/issues/1222).
- Next: isolated schema rehearsal, verified tenant RLS, genuine backup/readback; owner-phone authenticated packet selector and historical readouts only after trust/canary evidence; PR stack reconciliation under CI.

**Certification requirement:** exact-head Social/Growth/Web/UX/Media/JLLM/Spatial/Web Deploy/Launch. Keep draft/unmerged.
