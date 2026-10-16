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

## Continuation: overlapping memory cohorts

Memory retrieval now admits only non-executing learning cards whose positive integer sample size equals their unique, nonblank lesson IDs. It ranks candidates deterministically, then selects whole disjoint lesson cohorts before applying the result limit. Duplicate snapshots cannot crowd independent cohorts out of the top five or multiply the reported sample weight. Partially overlapping aggregate cards are skipped because their remaining contribution cannot be recomputed without raw lessons.

Validation: 49 focused tests pass with no skips, plus targeted strict TypeScript. Regression covers seven duplicate snapshots, an independent opposite-sign cohort, shuffled input order, partial overlap, duplicate/blank lesson IDs and inflated/nonfinite sample counts. This is lesson-level de-duplication, not proof of statistical independence across different horizons or correlated decisions; decision-level lineage and canonical Purse cohort accounting remain open.

All 16 reported workflows on prior head 714f7e8c passed, including full Launch Gate (38483840522), Shadow repair (38483840495) and synthetic PostgreSQL restore (38483840428). The earlier Director lease failure did not recur. These are code/CI results, not deployed operational proof. This new memory patch requires its own remote checks.

## October 14 continuation: standalone scan and outbox backlog

The standalone forward outcome scan now reserves a bounded keyset page ordered by decision time and ID using a persisted, row-locked cursor. It wraps to the start of the current lookback after the end. Reservation commits before processing, so a crash cannot permanently pin the cursor to the oldest page. Individual decision errors no longer abort the remaining decisions; the cycle still reports failure after allowing other records to progress. Failed records are revisited on wrap, not immediately retried forever.

Both authenticated HTTP export and CLI export now run legacy-grade review and bounded outbox reconciliation before selecting pending records. Missing queue rows are reconstructed from the six durable learning ledgers, including baseline/target sample fields. Existing pending, exported and acknowledged entries are never overwritten or reset. The original quarantine export filter remains in force. Replay manifests have no equivalent immutable ledger and are not reconstructed.

Validation: 52 focused tests pass, no skips; targeted strict TypeScript passes. Database tests verify tied-time cursor progress, restart persistence, wrap after a deliberately unprocessed page, bounded queue repair, exact original payloads for all six record types, preserved acknowledgements and quarantine. A runtime test proves one failed decision does not starve the following decision.

Scope limits: this repairs standalone forward scans only. Canonical Supabase scan fairness and replay result caps remain open. The existing lookback still bounds recovery; records aging out require explicit historical replay/recovery. Capacity must be sufficient to wrap before records age out. Production data was not modified and no deployment was made.

CI on prior head 3a1cd34d: Shadow repair, full Launch Gate, Money certification and web deploy checks passed. Synthetic PostgreSQL restore failed again (38486009754), so backup-drill reliability remains unresolved despite intervening successful runs. New-head CI and reconciliation with current main remain required before merge.

## October 15 — disposable PostgreSQL initialization race

CI on `9b31000d` passed 15 of 16 reported workflows, including Shadow repair
(`38658989648`) and Launch Gate (`38658989851`). Synthetic PostgreSQL restore
(`38658989861`, job `116175472488`) failed after about two seconds with only a
generic error. That log cannot prove which command failed.

Both source-dump and destination-restore helpers accepted Unix-socket readiness
from the image's temporary initialization server. Docker's official entrypoint
starts that server with `listen_addresses=''`, stops it, and then starts the
final PostgreSQL server. Both helpers now wait on container-local TCP
`127.0.0.1`, retaining `--network=none` and no published ports. This removes a
confirmed code-level race, but whether it caused every prior failure requires CI.
Source: https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh

Synthetic failures now include a fixed stage label without printing exception
text, subprocess stderr, paths, credentials, or the caller environment. New
regressions simulate socket-only initialization before TCP readiness for both
helpers, readiness exhaustion with cleanup and no writes, and diagnostic
redaction. The two targeted suites pass all 16 tests. Full backup suite: 117
pass, three fail at fixture setup because this execution environment denies
Unix sockets; no test assertions in those three ran. Docker is unavailable here,
so real dump/encrypt/decrypt/restore verification remains a CI requirement.

A read-only `git merge-tree` check against main `4cc160c6` produced a clean merge
(tree `0f4f8a00adc2a55e7f02831eabd6723c59bbb4a6`) before these changes. No main
merge, deployment, production restore, database migration, or trade occurred.
Canonical scan fairness, replay limits, cohort accounting and live learning
proof remain open as described above.
