# SHARK / Shadow learning write repair — 2026-10-13

Status: code-only, review branch. No deployment, database migration, host commissioning, trading, or live authority change.

## Source reconciliation

This integration incorporates existing repair PR #1185 (6ce44e66feaf2ca5b7d00c11b7f5ec3074e1e926) onto current main. Most files in the integration diff are inherited point-in-time grading, original-history recovery, Google Drive backup and host-admission work. They are not newly authored or newly production-certified by this repair.

The bounded new patch touches the shared learning builder, standalone store/runtime/replay, canonical worker's grading guard, focused tests, and Shadow CI. Current-main Telegram and sports work is preserved.

## Fixed here

- Counterfactual lessons require a finite decision-relative return. Missing prices and launch-relative prices cannot silently become zero-return performance labels. Genuine flat returns remain gradable. The canonical worker retains raw observations and skips their performance lesson when ungradable.
- Decision, execution, observation, lesson, calibration and memory inserts commit atomically with their own sync-queue entry using a PostgreSQL data-modifying CTE.
- Standalone runtime and replay persist an observation and its lesson within one transaction. A lesson or queue failure rolls back the entire outcome.
- Pre-repair observation-only rows bearing known PIT/replay evidence markers remain retryable. Retry reuses the persisted observation and original target sample, including when a different earlier backfill becomes available. Quarantined and unrecognized legacy rows are excluded from automatic recovery.
- Replayed outcome payloads must match stored observation, target sample and lesson JSON. An existing ID with changed return data fails closed.

## Validation

45 tests passed across learning, PIT, runtime, replay, legacy corrections, readiness, production-certification contracts and database recovery. No skipped tests in this run. Database tests ran on isolated PGlite PostgreSQL, not production. They inject queue constraint failures, verify rollback and exact-once retry, preserve observation-only evidence, reject changed replay payloads and preserve quarantine. CI now runs the same database test against a disposable PostgreSQL 16 service.

Strict targeted TypeScript checking passed for the changed money-core modules and regression tests. Full monorepo type checking and real PostgreSQL CI are pending remote CI. The web worker guard has not had a full application build in this environment.

## Remaining audit findings — not closed

1. Canonical Supabase recovery across decision → execution → position and observation → lesson → purse remains incomplete. Its observation-only horizon marker still skips interrupted dependent writes.
2. Standalone decision → execution and lesson → calibration → memory recovery still need durable completion/reconciliation. The transaction added here covers outcome + lesson + their queue entries, not the entire learning graph.
3. Old ledger rows whose outbox insert failed before this repair need a separate reconciliation/backfill. This patch prevents new split writes; it does not claim to reconstruct all historical missing queue entries.
4. Bounded oldest-first scans can starve later decisions; records outside the configured lookback are not automatically recovered.
5. Canonical schema readiness, RunPod import-to-canonical projection, assessment ingress, original data recovery and continuous forward-paper operational proof remain open.
6. Overlapping memory cohorts and launch-relative excursion/timing semantics need independent repair. This patch addresses return grading, not every input used by timing diagnosis.
7. Telegram research previews remain separate from verified canonical SHARK learning. Current-main additions do not prove a connected learning loop.

Next coding target: canonical resumable stage reconciliation with immutable observation reuse, then durable downstream calibration completion and unique-cohort memory accounting. Keep operational commissioning separate from code correctness.

## Continuation: canonical reconciliation and downstream recovery

Supersedes remaining items 1 and the lesson-to-calibration portion of item 2 above, within the existing scan/lookback limits:

- Existing canonical decisions now recover missing execution simulations and positions. Saved executions are reused; if one never committed, recovery uses the frozen decision with an explicitly evidenced liquidity-model simulation. It does not reconstruct a lost external execution quote from current data.
- Saved observations no longer mean downstream work is complete. Each scan idempotently resumes lesson and Purse writes, then calibration, memory and strategy profile. Saved evidence is reused without depending on a surviving launch lookup or changed backfill.
- Persisted observation binding, authority and horizon time are checked before grading. Duplicate horizon observations fail closed.
- Calibration/profile timestamps derive from the evidence cohort rather than each worker's wall clock. Exact-cohort retries create no new snapshots. Existing overlapping cohorts and old clock-derived snapshots are not deduplicated by this patch.
- Standalone forward/replay scans also revisit downstream calibration and memory after completed outcomes. Standalone decision-to-execution recovery remains open.
- JSON replay comparison now ignores JSON object key order while preserving array/value differences, so PostgreSQL JSONB ordering cannot cause spurious conflicts.

Local validation: 46 money-core tests (including isolated PGlite database tests) and 16 web tests passed. Fourteen new canonical recovery tests use the actual worker and repository with an in-memory PostgREST-shaped fault injector; these do not prove deployed schema, RLS or REST behavior. Targeted strict money-core TypeScript checks passed.

Prior remote CI at c324e9af: money-core TypeScript, PIT/runtime contracts, Money certification and web deploy conformance passed. PostgreSQL recovery test failed because pg-pool discarded its connection on the injected error, losing a session-only search_path. The test now supplies search_path as a connection startup option so replacement connections use the disposable schema. Fresh PostgreSQL CI is required to verify that correction.

An inherited Google Homebase synthetic PostgreSQL restore job also failed (run 38433750304) with only `synthetic drill failed`; its unit tests passed but the actual isolated dump/encrypt/decrypt/restore did not. This remains an independent unresolved verification blocker. No successful backup-restoration claim is made.

Still required: schema readiness and REST integration evidence; fair scans beyond oldest-first bounded windows; standalone decision/execution reconciliation; historical queue backfill; unique-cohort memory accounting; operational commissioning and forward-paper proof. No production changes were made.

## Continuation: standalone decision/execution recovery

New standalone forward/replay discoveries now persist decision + simulation + both outbox entries in one transaction. A failed execution write leaves no cooldown-blocking partial decision. Replay validates the persisted decision JSON, baseline sample/price and execution JSON; changed payloads under existing IDs fail closed.

For pre-repair decision-only rows, outcome and replay scans reconstruct the original liquidity-model simulation from frozen decision notional, market evidence and decision time. Existing simulations are reused. This closes the decision-to-execution gap for records admitted by the current scan/lookback, without consulting new discovery quotes or changing trading authority.

Validation: 48 focused money-core tests pass locally with no skips, including PostgreSQL/PGlite injection of execution queue failure, full rollback, exact-once retry, changed-baseline/execution rejection and deterministic old-row reconstruction. Targeted strict TypeScript checking passes. No production writes or deployment.

Remote CI evidence for prior head 8379be25 is now available: Shadow repair (run 38449162237), synthetic PostgreSQL restore (38449162164), Money certification and web deploy conformance all passed. The previous synthetic restore failure did not recur; this proves the synthetic drill only, not original data recovery. Full launch gate failed in unchanged Director `generation-service.e2e.test.ts`, test `keeps a long provider submission fenced by a renewing lease` (expected one provider submission, observed two). Do not report the entire PR as green or deployment-ready.

Next unresolved correctness targets: scan fairness beyond bounded windows, historical missing sync entries, overlapping memory cohort accounting, and schema/import integration. Original-history and operational proof remain separate.
