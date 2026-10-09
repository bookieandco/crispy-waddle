# PURSE-AUTO.09–.13: evidence-first commissioning handoff

Date: 2026-10-08 PT / 2026-10-09 UTC.
Source branch: `feat/purse-auto-09-13-20261008`, stacked above draft #1166, which is stacked above draft #1162.
Scope: standalone PostgreSQL source changes, historical learning holdout, paper-only owner-payday reconciliation, phone read-only status and research-only certification. **No real bank, Phantom, broker, provider, payment, bet, or live-money actions.**

## Original ledger location and truth
- Original RunPod bootstrap configured `SHARK_SHADOW_DATA_DIR` default `/workspace/jhadina/shark-shadow`; PostgreSQL data subdir `/workspace/jhadina/shark-shadow/postgres`; `SHARK_SHADOW_POSTGRES_DB=jhadina_shadow`, port 55432.
- Previous inventory discovered **8 stopped Shadow CPU pods** but no original surviving local filesystem/Network Volume was proven. Only an owner-authorized existing machine should inspect and attempt recovery.
- SWLC Postgres still rejects read-only query with SQLSTATE `57P03`; production recovery sync skipped actual export/import on HTTP 500.
- Connected Google Drive `SHADOW-PAPER-TRADING/01-LEDGER-SNAPSHOTS`, `02-MARKET-REPLAY`, `03-LEARNING-MEMORY` inventory did not locate any actual restored original ledger. Canaries are explicitly synthetic and cannot enter memory.
- Historical evidence must remain flagged `ORIGINAL_LEDGER_NOT_RECOVERED`; new forward paper history, if later commissioned, is not a substitute and must be separately labeled.
- The certification review supports `lineageMode=NEW_FORWARD_ONLY` with `forwardOnlyHistoryIsolated=true`: this waives only the *original-history restoration requirement* for a genuinely new separately named dataset, not durable PostgreSQL readback, encrypted Drive restore, licensed feeds, mature outcomes, watchdogs or independent external review. Never erase the original recovery incident.
- Reuse draft recovery PRs #1148 / #1149 and original source inventory; do not create a replacement billable Pod or delete old state.

## .09: durable paper ledger source
- `packages/money-core/migrations/033_purse_auto_paper_09_13.sql` defines fenced lease, append-only paper cycle and paper-payday receipt tables with fixed non-execution columns, owner bindings and force-RLS.
- `PostgresPursePaperStore` uses PostgreSQL conflict/lease checks for single-writer fencing and append-once rows, stable economic fingerprints across lease reacquisition, conflict rejection and independent readback.
- Migration is **source only**. It has not been applied to an authenticated live PostgreSQL instance. For SWLC, create and verify the canonical Supabase migration with CLI after disk/full database recovery and privileges audit.
- The worker must use a dedicated trusted SQL connection and database-enforced lease, not phone localStorage or in-process locks. No worker claims certified without independently verifying restart, readback and backup.
- Restore: owner-approved original host -> `pg_dump -Fc` -> encrypted Restic or age before Drive -> worker-scoped Google OAuth -> independent SHA-256 readback -> restore to isolated database -> verify nonempty source/restored ledgers, horizon keys and counts -> later SWLC reconciliation.

## .10: real out-of-sample learning
- `comparePursePaperLearning`: same held-out opportunities, liquidity, treasury and risk limits for both no-memory baseline and memory-informed policy.
- Requires time-split cutoff and source IDs admitted from previous independent decisions; rejects profile IDs not in eligible verified horizon lessons.
- Output says `DECISION_CHANGED` or `NO_OBSERVED_DECISION_CHANGE`; never implies improvements or profitability without external adjudicated future outcomes.

## .11: Owner Payday paper-only
- `reconcilePursePaperPayday` reuses Coffer double-entry reconciliation and verifies hypothetical source, destination and fee ties.
- Every receipt is labeled PAPER, `provesRealSettlement=false`, `canMoveMoney=false`. It is never a bank transfer or settled on-chain event.
- Real owner payday remains behind explicit owner approval, commissioned payment rail, verified destination, permit and actual settlement evidence.

## .12: phone status
- `/money/purse` now renders `PurseStatusPanel`, reading `GET /api/money/purse/status`.
- Authentication + owner filtering precedes reads; only validated metadata is returned and errors return unavailable, never guessed balances.
- Status `QUERY_READ_ONLY` represents one successful query, not independently certified durability. Backup, original history, live bank and Phantom commissioning stay NOT VERIFIED.

## .13: certification truth
- `reviewPursePaperCertification` rejects non-independent readback, missing encrypted Google Drive recovery, unproven original ledger, expired/missing provider rights, fewer than three unique watchdog cycles over 30m, nonpersistent restart proof, missing simulated fee/fill evidence, weak/early/synthetic 15m/1h/4h/24h/3d/7d outcomes, missing out-of-sample learning and paper payday tie-out.
- Even a complete owner-supplied receipt returns `EXTERNAL_REVIEW_REQUIRED` with `paperCertificationIssued=false` until independent external attestations; it **cannot self-certify operational truth from fixtures**.
- `SOURCE-CERTIFIED` means exact-head tests, CI and review; `STORAGE-CERTIFIED` means independently observed real DB+encrypted restore; `PAPER-CERTIFIED` means genuine multi-cycle runtime, never source code alone.
- No automatic financial execution authorization.

## Post-code operational sequence (blocked by real infrastructure)
1. Pass exact-head PR #1162 then #1166 then this stacked branch. Reconcile newer `main` modifications and never bypass protection.
2. Restore SWLC capacity and authenticate original Pod/Network Volume. Read-only inventory first. Retain original evidence.
3. Execute migration on authorized host only after schema and privilege checks. Prove append-once receipt survives worker and database restart.
4. Configure trusted worker Google OAuth; independently encrypted snapshot and isolated restore.
5. Commission licensed market data and continuous paper worker with bounded leases, watchdogs and real time-matured observations.
6. Independently certify original history integrity, deterministic forward replay, learning influence, paper payoff fees/slippage and zero financial side effects.
7. Use owner approvals and separately verified bank/Phantom rails only when real movement requested; do not auto-fund or auto-withdraw.
