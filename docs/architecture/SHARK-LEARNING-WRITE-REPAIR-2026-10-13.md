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
