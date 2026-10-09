# PURSE-COMMISSION.01–.05 — operational truth / completion handoff

Prepared 2026-10-08 PT (2026-10-09 UTC). Draft stacked PR: https://github.com/bookieandco/crispy-waddle/pull/1188
Required review order: #1162 → #1166 → #1186 → #1188. Do not merge partial stacks independently or bypass exact-head CI.

## Completed SOURCE code vs unverified production
**.01 Paper database:** `PostgresPursePaperStore` has SQL-server-clock leases, monotonic fencing, economic replay across worker renewals, strict owner-bound inserts, readback SHA-256, no-trade authority, non-executing paper-payday receipts. `purse-commission-pg.integration.test.ts` exercises real disposable PostgreSQL in portable CI, including two independent SQL clients. No actual owner Homebase/RunPod PostgreSQL commissioning or database reboot persistence proof yet.
**.02 Backup/restore:** Portable CI exports a **synthetic, nonempty, disposable** database with `pg_dump -Fc`, verifies SHA-256 and restores to an isolated second PostgreSQL database with matching row counts. This is **not** an encrypted Restic snapshot, worker Google OAuth, or the user's original SHADOW trading ledger. Reuse existing source from draft SHADOW recovery PRs #1148 and #1149 rather than implementing a parallel backup product.
**.03 Paper runtime:** `runPurseCommissionPaperTick` takes owner-bound, point-in-time input with a source provenance/rights receipt and strict non-synthetic data claim, requests a real DB lease, creates bounded Purse paper decisions, appends exactly once and reads back. It deliberately makes no provider API, bank, Phantom, broker, executor, scheduler or wallet calls. No authorized trusted market feed has been supplied and no continuous worker has been commissioned.
**.04 Learning replay:** Reuse `reviewPurseShadowEvidence` to quarantine invalid/future/immature grades and `comparePursePaperLearning` for source-scoped, time-split comparison. Actual real-provider future outcomes at 15m/1h/4h/24h/3d/7d, measured fill/fee/slippage and true decision improvement are **not** proven. None may be backfilled from today's prices.
**.05 Final proof:** Reuse `reviewPursePaperCertification`, which hard-blocks unauthenticated provider data, fewer than three unique watchdog cycles across >=30 minutes, missing persisted/restart verification, missing genuine six-horizon observation proof, unverified encrypted backup and unbalanced paper-payday. Even a structurally complete manifest yields EXTERNAL_REVIEW_REQUIRED / paperCertificationIssued=false. Neither fixtures nor GitHub green authorize live money.

## Source inventory / external blockers
- SHADOW configured local PostgreSQL root: `/workspace/jhadina/shark-shadow/postgres` (RunPod); 8 stopped Shadow-named Pods observed historically, but no original Network Volume identity or durable original ledger proven.
- SWLC Supabase project `kqbkaozfjubkjevdfvic` still returns SQLSTATE `57P03` / HTTP 500; control-plane status does not constitute PostgreSQL health. Reference issue #1110.
- Connected Google Drive `SHADOW-PAPER-TRADING/01-LEDGER-SNAPSHOTS` and `03-LEARNING-MEMORY` were empty at last authenticated inspection. Existing canaries are synthetic. Original ledger remains `ORIGINAL_LEDGER_NOT_RECOVERED`.
- Existing Railway projects only OverageOS and PupsonStuff Media Services; no existing Purse Postgres host identified. Do not repurpose unrelated billable services or provision one automatically.
- Separate `NEW_FORWARD_ONLY` paper dataset may be commissioned independently with an owner-authorized durable host and new receipts. That MUST NOT replace or be mislabeled as original recovered history.
- Google Drive requires OAuth on the actual worker, separate from ChatGPT/phone/Colab. Encrypt with Restic/age *before* uploading; independently inspect content hashes, restored DB counts and source lineage.

## Commissioning acceptance gates (requires external, not simulated evidence)
1. Authorize an **existing** trusted Homebase worker or approved host and one persistent PostgreSQL database. Validate least privilege and current schema; run migration `033_purse_auto_paper_09_13.sql` only on that owner-approved host. Confirm health after real worker+database restart.
2. Inspect original SHADOW Pod and available volume metadata without starting/paying compute. Recover the original consistent dump where genuinely possible and preserve source; otherwise record an unresolved-original incident.
3. On worker, configure exact-folder Drive OAuth and existing SHADOW Restic recovery path; perform **real encrypted snapshot, exact remote readback SHA and isolated restore**. Demonstrate that restore independently.
4. Connect independently licensed and verified read-only provider quotes; run real fenced paper ticks with no wallet signing or payment execution. Persist and replay receipts through host restarts.
5. Observe genuine matured 15m, 1h, 4h, 24h, 3d, 7d horizons (7d needs actual elapsed 7 days); retain actual observed price, quote and cost evidence. Verify at least three unique watchdog cycles >=30m apart collectively, evaluate later decisions vs frozen baseline, paper payday balancing, and independently review all logs.
6. Issue separate STORAGE-CERTIFIED and PAPER-CERTIFIED declarations only with independent readback. Never promote this source PR or its CI test to live trading, funding or original-history recovery.

## Safety invariants
No trades, bets, money movement, wallet signatures, bank transfers, ACH approval, paid compute, network broadcasts or financial mandate granted by this PR. Jhadina may propose but cannot control the verified owner payout destination, reserve policy or own charter. All source/runtime evidence is explicitly paper only.

Last-known branch before this work: `feat/purse-auto-09-13-20261008` head `e43cc7ccebae41f88556dcd3e172133153aa9370` (all 13 exact-head CI workflows succeeded). The current stacked PR must be checked independently.
