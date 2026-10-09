# PURSE-LIVE.01–.04 — source and Supabase audit/repair handoff

Date: 2026-10-08 PT / 2026-10-09 UTC. Owner: complete available code; MARK inaccessible Supabase stages AUDIT/REPAIR. Purse = real-money treasury (legacy Coffer persistence), SHADOW = paper-learning, Money Core = governed execution.

## .01 — Persistent storage: code ready; actual Supabase blocked
- inspectPurseLiveStorage performs READ-ONLY SQL probes for clock, pg_is_in_recovery, transaction read-only and mandatory legacy tables. It returns READABLE_BUT_UNCERTIFIED at most, never storage-certified.
- On an owner-approved persistent machine: set PURSE_LIVE_DATABASE_URL in a secret environment variable; run pnpm --filter @jhadina/money-core purse-live:storage-probe. It will not print credentials or modify data. No verified always-on Homebase DB is connected yet.
- SWLC project kqbkaozfjubkjevdfvic STILL returns PostgreSQL 57P03: database is not accepting connections / Hot standby mode disabled. Previous startup logs report WAL/crash recovery stuck after NO SPACE LEFT ON DEVICE.
- SUPABASE-AUDIT/REPAIR.P0: owner reviews disk/compute capacity and logs; retain original WAL, data and snapshots; arrange platform capacity/support action. No dropping data, forced vacuum, reinitializing DB or billable upgrades without explicit owner action.
- SUPABASE-AUDIT/REPAIR.P1: once Postgres accepts reads, capture immutable pre-repair backup, verify encrypted offsite upload and isolated restore; audit actual canonical tables, owner bindings, RLS and indexes; run missing reviewed migrations and database restart receipts. CI-only client reconnect is not a database restart.
- SUPABASE-AUDIT/REPAIR.P2: explicitly verify Data API access and role exposure after recovery; Supabase October 2026 API changes do not guarantee new public tables are automatically exposed. Grant only least-privilege backend access.
- An existing trusted always-on Postgres Homebase can replace unavailable SWLC if the owner authorizes it and the real ledger, backup, authorization and reconciliation are commissioned. Phone stays the screen; do not provision a new paid host automatically.

## .02 — Source merge/deploy: blocked until independently reviewed
- Stacked merge order: #1162 -> #1166 -> #1186 -> #1188 -> #1190 -> this P-LIVE PR. Each exact head must pass Money R13B, web build, launch gate and merge-protection checks. No blind auto-merge while production memory/DB is down.
- After merger, deploy exact main SHA to existing Vercel app; compare deployed commit, authenticated health, memory availability and real worker readback. CI synthetic canaries never satisfy operational certification.

## .03 — Real Purse custody: source gates built, money rails uncommissioned
- reviewPurseRealCustody binds immutable owner charter, treasury evidence, reconciled spendable liquidity, survival/owner-profit protections, provider-settled assets, provider holds, verified payout and source-event evidence. Stored bank/Phantom address or typed principal is NOT spendable or signed proof.
- Even structurally valid evidence yields EVIDENCE_REVIEW_REQUIRED, independentlyCertified=false, canTrade=false, canMoveMoney=false. Genuine provider authentication and the actual settled custody reconciliation are still needed.
- Owner-scoped GET /api/money/purse/live-readiness reads treasury/funding/mandate and bounded signer lease without exposing credentials; unavailable database causes fail-closed response. Real-money phone Purse page shows readiness; SHADOW remains separate.
- Commission real bank/ACH broker cash, verified account and payout endpoints, isolated DEX wallet signer, provider eligibility and actual deposited balances through MONEY-FUND.2/.3 rather than new rails.

## .04 — Live owner mandate: source proposal built, no activation
- buildPurseLiveMandateProposal produces a bounded reviewable Action Core activation action from an explicit live Purse charter, independent custody review, enabled lane and unique strategy/instrument allowlists. Reject amounts exceeding owner, position, lane and reconciled capital caps.
- Every proposal has approvalReceiptId=null, requiresActionCoreApproval=true, canActivate=false, canExecute=false. No fake owner approval or money movement.
- When the real owner explicitly approves limits, reuse existing createAutonomousMandateActivationRequest, Action Core authority and PostgresAutonomousTradingMandateStore. Separate Money risk veto, single-use permit, entitlement, provider canary, kill switch and UNKNOWN recovery are mandatory.

## Operational acceptance (not done by a draft PR)
1. Recover writable durable PostgreSQL or authorized Homebase with verified backup/restore, worker/database reboot proof, RLS and ledger reconciliation.
2. Review stacked PRs, merge safely and prove exact deployed SHA, authenticated app health and live worker readback.
3. Verify real provider custody, settlement, bank+wallet ownership, licensed data and owner payout route.
4. Obtain true owner approval for bounded standing mandate; only then run independently reconciled tiny live entry/exit canary before unattended automation.

SHADOW ORIGINAL HISTORY remains UNRECOVERED. New forward-only paper history remains distinct. Real trades, bank transfers, wallet signing, provider submissions and live payouts have NOT been authorized or executed in this sequence.
