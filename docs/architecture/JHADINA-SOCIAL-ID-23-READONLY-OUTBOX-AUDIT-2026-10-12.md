# JHADINA SOCIAL-ID.23 — Read-only weekly outbox reconciliation
**As of 2026-10-12 (America/Los_Angeles).** Stacked on draft PR #1220 at `1f7d308ff33ae55c2094dd6b428131a46530e314`.

## Audit/repair disposition
- `SOCIAL-ID.22` **LIVE COMMISSIONING BLOCKED_FOR_AUDIT_REPAIR**: [issue #1222](https://github.com/bookieandco/crispy-waddle/issues/1222).
- Parent `SOCIAL-ID.16` database/restore issue [#1211](https://github.com/bookieandco/crispy-waddle/issues/1211) remains open. Neither issue should be closed from source-only CI.
- Draft PRs #1206–#1220 are stacked/unmerged; upstream Social Juggernaut #1136 diverges and is not bulk merged.

## Source work
`apps/jhadina-web/src/lib/social/weekly-outbox-reconciliation.ts` implements `reconcileWeeklyOutboxReadOnly`, using .21's authenticated `recoverReviewedWeeklyChildBatch` to verify owner and current account+packet identity fingerprints before reading observed outbox rows. It checks canonical per-child action fingerprint and version-bound SHA-256 action ID, exact capability, parent receipt and non-executable flags. Owner, packet and child mismatches, unrecognized children and duplicate child records fail closed. It never accepts browser-derived snapshots as authenticated data.

Operator findings:
- `NOT_STAGED` is an informational missing child row, **not** proof an action needs automatic retry.
- `STAGED_INERT` confirms only an inert local entry, not an Action/Security dispatch permit.
- `STALE_LOCAL_ATTEMPT` or `FAILED_ATTEMPT` requires human review; no retry is scheduled.
- `UNVERIFIED_PROVIDER_OUTCOME`, `FUTURE_ATTEMPT`, `DUPLICATE_ATTEMPT`, `CORRUPT_RECORD`, unexpected state, or an attempted action without a stored approved outbox row are **QUARANTINED**.
- A `DELIVERED_CLAIM` never establishes actual post/message/ad/provider delivery. All reports hard-code `providerDeliveryVerified:false`, `canRetry:false`, `canDispatch:false`, `canPublish:false`, `canComment:false`, `canSpend:false`.

`apps/jhadina-web/src/lib/social/supabase-weekly-outbox-audit-repository.ts` contains a read-only, owner+packet+parent-receipt scoped, **commissioned:false** adapter for two *proposed*, **not verified installed**, relations `jhadina_social_weekly_child_outbox_v1` and `jhadina_social_weekly_child_attempt_audit_v1`. DB errors fail closed, and local adapter verifies row scope independently of RLS. No production endpoint/worker instantiates it.

Adversarial tests exercise owner isolation, unknown/duplicate rows, forged dispatch flag/capability, duplicate/future/unrecognized attempts, stale leases/failed attempts, delivery claims, DB outage, missing parent and read-only RLS-gated query behavior. Pure tests and adapter mocks are not real SQL/restore/provider proof.

## Production blockers and next work
1. Fix SWLC access, independently recover original backups, verify migration/RLS inventory (#1211).
2. Implement real atomic child-batch and child-outbox SQL, authenticated owner approvals and guarded current-identity dispatch with independent capability permits (#1222).
3. On isolated DB, commission the two audit relations and validate owner RLS + snapshot-consistent reads + immutable provider attempt provenance. Until then adapter remains disabled.
4. Integrate owner-phone read-only audit status, reconcile no-action and quarantine semantics, add verified provider delivery receipt adjudication. **Do not invent provider outcomes**.
5. Prove worker leases, provider idempotency and unknown outcome quarantine under crash/restart; no unattended sends/spend until user-reviewed production certification.

## Certification
Exact-head Social, Jhadina Web full tests/TypeScript, UX, JLLM, Media, Growth, Spatial, Web Deploy and Launch workflows to be checked. Keep PR draft and source-only.
