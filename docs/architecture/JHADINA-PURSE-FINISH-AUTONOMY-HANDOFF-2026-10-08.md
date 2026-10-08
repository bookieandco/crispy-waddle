# JHADINA-PURSE-FINISH / Autonomous Paper Learning Handoff

Date: 2026-10-08
Status: SOURCE CHANGES IN DRAFT PR #1162; PRODUCTION AND PAPER COMMISSION NOT CERTIFIED
Canonical repo: bookieandco/crispy-waddle
Branch: feat/purse-finish-integrity-payday-20261008
PR: https://github.com/bookieandco/crispy-waddle/pull/1162

## Do not duplicate the Purse or Shadow systems

Purse: governed allocation, liquidity, portfolio and rebalance only.
Money/Coffer: principal and reserve authority, accounting, original profit sweep policy, governed downstream execution.
SHARK: meme discovery/intelligence and point-in-time independent observation.
SHADOW: six-horizon graded simulation, counterfactual learning, durable lessons.
Personality/MIMS: evidence-aware finance posture, never execution rights or limits relaxation.
Phone: operator interface; never the continuously required database/worker host.
Google Drive: encrypted backup/owner handoff and disaster recovery, never active financial ledger or worker OAuth inherited from ChatGPT.

## Completed in PR #1162

1. Purse portfolio input rejects repeated accountId, positionId and ledger entryId before summing. Portfolio fingerprint now incorporates underlying account, position and reconciled ledger fields.
2. Purse allocator rejects repeated exposureId and opportunityId and enforces total per-instrument position headroom (including existing positions and new opportunities) instead of limiting only incremental per-opportunity sizing.
3. Purse rebalance binds positionId/accountId in reduction intents and in position-bound increases. Cross-account ambiguity fails closed instead of mapping by instrument alone.
4. Pending withdrawals are subtracted from available withdrawal capital.
5. Reuses existing Money Coffer accountant and double-entry accounting controls to form a non-executing profit waterfall and owner-payday journal candidate. Distinct declared `canExecute=false`, `canMoveMoney=false`, `canPost=false` constraints. No provider transfer submission.
6. SHADOW Purse strategy profile composes only the latest eligible horizon lesson **per decision** so 15m, 1h, 4h, 24h, 3d and 7d cannot count as six independent decisions. All raw horizon grades remain append-only for replay and audit.
7. Regression tests cover duplicate economic identities, per-instrument caps, position ambiguity, payout destination binding, stale cash evidence, non-execution and pending withdrawals.

Important audit caveat: existing historical Purse learning profiles built before #1162 may be contaminated by repeated horizon samples. Never carry them forward without reviewing and recalculating from verified decision-level lessons. Refer to SHADOW repair PR #1149; do not overwrite original evidence.

## Live evidence blockers

- SWLC Supabase control plane reports ACTIVE_HEALTHY but PostgreSQL read-only query returns FATAL SQLSTATE 57P03: database system not accepting connections (hot standby disabled). No claim that new migrations, financial ledgers, charters or scheduled runtime function.
- Existing production scheduler requires exact-head production and durable memory; prior scheduled job failed those gates. Do not weaken `/api/health`.
- Shadow ledger backup has not had encrypted real source -> Drive -> isolated restore verification. Prior owner handoff reported stopped SHADOW-named CPU Pods with no proven Network Volume recovery. Never create billable compute without owner consent.
- GitHub branch code and unit tests are not evidence of healthy production, profitable strategy, live deployment or completed owner payout.
- Source code in #1162 requires exact-head GitHub Actions checks and review before merging. Do not merge into an independently red `main` and claim certification.

## Google Drive existing handoffs (read-only source references)

- SHADOW repair and recovery plan:
  https://docs.google.com/document/d/1VeivVqUktImMzK5DHPlZlBgC0-foDq7e1Pp7xEj-bgc/edit
- Jhadina Personality/phone handoff:
  https://docs.google.com/document/d/1ctiQ19OuGMKOArqRWiln9UfqHC_Za4fuBz83fO-RYj0/edit
- Recovery code: https://github.com/bookieandco/crispy-waddle/pull/1148
- Shadow paper-learning repairs: https://github.com/bookieandco/crispy-waddle/pull/1149
- Existing SHARK/Coffer commissioning: https://github.com/bookieandco/crispy-waddle/pull/1047

A Drive file being present or Colab being authenticated does not prove the worker has an independent Google OAuth remote. Backups must be encrypted at source, verify SHA-256 on independent readback, restore to a disposable instance, verify row counts/horizons/authority, record signed redacted receipt, then enable approved scheduled backups with freshness alerts. Never upload signing keys, wallet seed phrases or live credentials.

## Next coding sequence: PURSE-AUTO.06 through .13

### PURSE-AUTO.06 — Repair source + exact-head certification
- Wait for new PR #1162 checks and fix failing Money / Sports suite with actual reported error; unit + typecheck and full regression.
- Inspect PR #1148 / #1149 head and reuse their work, rebase only after exact collision audit. Merge independently proven fixes, no duplicate migrations.
- Audit remaining custody identity, same economic account with different aliases, evidence freshness and position attribution; fail closed if ambiguous.

### PURSE-AUTO.07 — Evidence admission and quarantine
- Source-contract on SHADOW outcomes, unique decision/horizon and explicit point-in-time market samples. Keep original raw evidence immutable.
- Quarantine legacy invalid/unverified grades, noisy duplicates and weak provider observations.
- Run deterministic replay; eligible profile built from one latest independent decision each, never six horizon samples.
- Degraded/unknown evidence may reduce confidence or cause review, never justify a higher allocation.

### PURSE-AUTO.08 — One autonomous paper loop
- Existing protected scheduler -> read-only capture -> opportunity normalization -> MIMS -> Money risk -> Purse charter/liquidity -> paper rebalance -> paper simulated fill -> future horizon observation -> calibration -> next decision.
- Fenced distributed lease, idempotency key, checkpoint recovery, bounded retries and explicit `PAPER_AUTONOMOUS`/zero-submission contract.
- Source receipts: inputs, hashes, cutoff, model version, decision, resulting simulated economic outcome, counterfactual and learned profile lineage.

### PURSE-AUTO.09 — Durable ledger recovery and Google Drive
- Once SWLC accepts SQL, introspect actual schema and applied migration history; avoid blind re-migration.
- Recover original SHADOW ledger from existing authorized pod or validated backup, independent isolated restore, reconcile historical rows before importing.
- Verify encrypted Drive roundtrip and test recoverability. No fallback to Drive as primary Postgres.

### PURSE-AUTO.10 — Prove self-learning changes subsequent actions
- Compare frozen baseline policy vs policy with accepted memory on the *same* decision-time evidence set.
- Show changed confidence/sizing/skip decision linked to actual prior closed decision outcomes; replay should be deterministic and avoid future leakage.
- Use time-split holdout, diverse market regimes, slippage, fees, liquidity and drawdown; report false confidence and live profit uncertainty.

### PURSE-AUTO.11 — Paper Owner Payday and reserve cert
- Reuse Coffer accounting + Purse liquidity. Verify realized, settled, attributable profit after taxes/fees, defensive reserve, prior payouts, pending withdrawals and earmarked owner-sweep hold.
- Generate proposal, double-entry journal, idempotent ledger status and two-sided simulated reconciliation.
- No payment provider submission, no account credential access, no owner destination change, and no standing live sweep mandate issuance.

### PURSE-AUTO.12 — Phone operator console
- Read-only balances with explicit freshness; sources vs derived net worth; paper returns vs realized profits separate.
- Charter version approvals, per-lane caps, hold/stop, learning-grade quarantine, replay, recovered backups, owner paydays and reason codes.
- Phone never hosts a required always-on worker. Local-only observer mode works while SWLC is unavailable.

### PURSE-AUTO.13 — Independent continuous certification
- At least three real sequential healthy watchdog cycles across >=30 minutes, one restore receipt, scheduler exact-head, healthy SQL and signed worker identity.
- Actual 15m/1h/4h/24h/3d/7d outcomes only as horizons mature; no synthesized marks.
- Prove invalid grade exclusion, repeat/restart idempotency, per-lane zero execution, persistent lessons and measured influence on later decisions.
- `PURSE-AUTO.PAPER-FINAL` only for real unattended paper operation with clear source/runtime/performance statuses; `LIVE-GOVERNED` remains separately owner-authorized and uncertified until downstream permits/reconciliation exist.

## Truthful exit conditions

SOURCE-CERTIFIED: exact branch green and tests prove all invariants.
STORAGE-CERTIFIED: authentic SWLC write/read and encrypted Drive restore, with durable record counts.
PAPER-CERTIFIED: owner-authorized unattended worker demonstrably runs on real historical/live market observations without transfer/sign/order authority, persists outcomes and learns across subsequent runs.
OWNER-PAYDAY.PAPER-CERTIFIED: balanced paper payout journal with eligible settled-profit evidence and no financial side effects.
LIVE-CERTIFIED: intentionally outside this milestone; requires separate owner financial mandate, provider commissioning, limits/permits and live reconciliation.

Unrestricted live execution stays disabled, and non-executing model outputs never imply authority.
