# MONEY-FINISH.13 → .14 — Paper incubation, real-evidence gates and Shadow watchdog

Date: 2026-10-08. Project: `bookieandco/crispy-waddle/packages/money-core`.

## Dependency graph
`main` ← P0 [#1170](https://github.com/bookieandco/crispy-waddle/pull/1170) ← feeds [#1171](https://github.com/bookieandco/crispy-waddle/pull/1171) ← models [#1173](https://github.com/bookieandco/crispy-waddle/pull/1173) ← Strategy Factory/MIMS [#1174](https://github.com/bookieandco/crispy-waddle/pull/1174) ← **this PR**.

These dependent PRs were still unmerged when this work began. The branch is stacked, not main. Reconcile/rebase in order with exact-head CI after every merge.

## .13 — Strategies incubate, observe, pause, audit, and require explicit resumption
`src/money-finish-incubation.ts` provides:
- Hash-bound candidate IDs from `money-finish-strategy-factory.ts` and MIMS review from `money-finish-market-iq-mims.ts`.
- A versioned hash-chained receipt state machine: `REGISTERED → INCUBATING → PAPER_OBSERVE`; `PAUSE → PAPER_PAUSED`, `REJECTED` terminal, explicit human `REQUEST_REVIEW` followed by `RESUME_AFTER_REVIEW` **returns to INCUBATING**. It never places a trade, and refuses to resume directly into `PAPER_OBSERVE`.
- Admission to `PAPER_OBSERVE` requires verified source rights, original Shadow persistent recovery, separate durable readback, **three completed real paper cycles**. Input flags are claims of operational evidence, *not* cryptographic proof by themselves; a commissioning actor must verify the underlying receipts.
- A fixed transparent deterioration monitor reuses `StrategyLearningRecord` from `autonomous-strategy-learning.ts` (generated from closed `PaperStrategyResult`) and pauses on stale/future feed, provider degradation, unverified journal, overdue paper outcomes, too few learning samples, rolling drawdown, consecutive losses, excess slippage, low paper fill rate. Rejects duplicated future/forged strategy learning. The monitor never edits learning history or financial mandates.

## .14 — Point-in-time six-horizon grading, disk persistence and watchdog
`src/money-finish-forward-grades.ts`:
- Defines six fixed horizons: **15m, 1h, 4h, 24h, 3d, 7d** from the decision timestamp. Each requires a source-rights and as-of-available **entry bid/ask**, valid later **exit bid/ask at/after due horizon**, with bounded observation lag and verified receive/availability timestamps. Missing/late marks are **not silently forward-filled or estimated**; callers must surface overdue/unresolved grades to `.13`.
- LONG synthetic marketable crossing uses entry ask → exit bid; SHORT entry bid → exit ask; adds declared other round-trip costs. NO_TRADE counterfactual is zero P&L, not a broker fill. Marked `FORWARD_PAPER_EVIDENCE_ONLY`, `canExecute:false` and `canAuthorizeLive:false`. Requires external licensed and proven data to represent real records.
- A source-rights string alone is **not** proof the provider is connected/licensed. It is the research contract; external admission checks remain mandatory. Corporate-action adjustments and FX swaps must be accounted separately before any real grade can be trusted.

`src/money-finish-forward-journal.ts`:
- A local file-backed **append-only hash-chain JSONL journal** with atomic `wx` lock acquisition, fsync before readback, grade idempotency and divergence rejection. A new instance validates the hash chain and grade identity; file truncation, tampering, repeated horizons, or interrupted partial lines fail closed. A stale lock requires operator audit/repair and is never silently broken.
- It can persist on a locally durable Homebase mount independent of Supabase, **if that mount and its backups are actually provided**. A GitHub Actions ephemeral runner fixture is *not* a commissioned durable Homebase volume and does not recover missing original RunPod/Shadow data. This adapter is single-host; independent cross-host backup, disk corruption resilience, concurrent distributed writes, periodic backup+restore and checksum readback still require operational work.
- Watchdog reconciles 3+ ordered separate cycles, specific journal prefix hashes/counts, independent readback, all horizon coverage, external source license, original Shadow recovered evidence. A fixture report must be classified `SYNTHETIC_FIXTURE` and remains `AUDIT_REPAIR_REQUIRED`. Even a complete all-real evidence manifest only reaches **`EVIDENCE_REVIEW_ONLY`**, never an unattended/live certification or order authority.

## P0 blockers / audit repair, NOT bypassed
- Real market feeds/permissions, verified actual daily/intraday bid/ask and options contracts are NOT connected by this PR.
- Previous failed or unavailable original Shadow/RunPod volume must be independently inventoried, backed up, restored and read back, with matching hashes. If unavailable, mark audit/repair. Do not forge synthetic historical paper grades.
- Supabase/database service, multi-host distributed lock, archival backup into Google Drive and original data restore still need real machine credentials and receipts; code can operate on local writable path only.
- Market-IQ production worker and Jhadina frontend integration are not commissioned; no AI/ML predictive performance was proved.
- No billable GPU, payment, live order, broker, bank funding, Phantom signing, or automatic live trading; no capital mandate changes.
- Existing stock/FX/option risk-grade adapters and `PaperLearningStore` remain authoritative for their own events; this new read-only grade journal does not overwrite them or falsify graded outcomes.

## Tests and next slice
`MONEY-FINISH.13–.14 Paper Incubation and Shadow Watchdog` CI: typecheck, old paper/learning test coverage, new negative lock/provenance/chronology/age/idempotency tests, full Money Core regression. Always quote the exact commit SHA when reporting tests.

Next `MONEY-FINISH.15 → FINAL` should: reconcile stack and root CI, commission providers read-only, verify source entitlement and machine credentials, independently restore original Shadow data, prove durable Homebase/Google Drive backup+isolated recovery, run real paper cycles over the full forecast horizons, ensure watchdog continuity, record MIMS/owner review and issue evidence-backed FINAL only then.
