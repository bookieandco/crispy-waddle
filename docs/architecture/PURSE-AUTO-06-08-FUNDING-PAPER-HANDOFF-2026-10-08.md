# PURSE-AUTO.06–.08 — Funding + autonomy source handoff

## Branch and audit
- Stacked draft PR: https://github.com/bookieandco/crispy-waddle/pull/1166
- Required preceding P0 repair and paper payday: https://github.com/bookieandco/crispy-waddle/pull/1162
- Canonical source: `bookieandco/crispy-waddle`.
- Live withdrawals, deposits and trading **not commissioned** by this change.
- Merges require exact PR head checks and successful independent review. Do not override failing CI.

## Previous Money Core bank + wallet rails found; do not rebuild
- USD bank account read and Link: `apps/jhadina-web/src/app/money/command-center/connect-bank-button.tsx`.
- Existing Funding Desk: `/money/funding?action=deposit` or `?action=withdrawal`.
- Governed proposal/approval: `/api/money/movement-proposals`, `/approvals`.
- Money-FUND.2/.3 = verified endpoints → owner approval → Action Core permission → Money execution permit → provider commissioning → exact-once attempt → settlement reconciliation.
- Coffer Treasury = deposit, withdrawal and same-asset transfer for fiat and on-chain assets; multi-asset conversions are separate routes.
- Phantom browser connection: `apps/jhadina-web/src/lib/money/phantom-wallet.ts`; wallet registration is not a verified signed-ownership receipt, and no secrets are imported.
- Isolated Coffer signer/DEX wallet is distinct from the owner Phantom wallet. Owner Phantom never grants unattended signing authority.
- Owner payout destination is protected by charter, not mutable by Jhadina.

## .06 source: owner funding
- Added `purse-funding-contracts.ts` to prepare owner-bound non-executing USD deposit/withdraw proposals through existing Money funding structures, and SOL/USDC same-asset owner-Phantom/Coffer proposals through Coffer Treasury.
- These functions **do not call providers, execute transfers, create live permits or submit signatures**.
- `assessPurseFundingReadiness` differentiates bank visible from *bank payment verified + live funding rail certified*, and Phantom connected from *signed ownership evidence + Coffer wallet + commissioned chain rail*.
- Added phone-facing `/money/purse` route with canonical Funding Desk, bank Link, owner Phantom connection and approval shortcuts.
- Bank balances and transactions from Plaid are **not** authorization for ACH; external payment rails need separate KYC, provider acceptance, payment credentials and direction-specific settlement canaries.
- Wallet address-only `ACTIVE` records are not proof of control. The signing challenge must be server-generated, single-use and signature-verified before any wallet transfer eligibility can be marked true. Existing client-only `signOwnershipChallenge` helper does not certify server ownership.

## .07 source: decision-based grading
- `reviewPurseShadowEvidence` excludes cross-owner/strategy lessons, missing signed provenance, future evidence, premature horizons, invalid grade values, previously invalid decision IDs and contradictory same-decision/horizon grades.
- Retains one latest independently verified horizon **per decision**, not six fabricated samples. Quarantine is a research-only output.
- Historical grades and legacy contaminated profiles still need replay/re-admission from verified market samples before promotion to live memory.

## .08 source: bounded paper cycle
- `buildAutonomousPursePaperCycle` reuses canonical Purse capital allocator → decision set → rebalance planner, enforcing owner-scoped state, 15-min freshness, paper-only charter modes, a positive fencing token, non-expired lease, bounded capital and review-accepted learning lineage.
- Produces deterministic `PAPER_SIMULATION_INPUT_ONLY` intents, never real fills or profits.
- `recordAutonomousPursePaperCycle` takes an append-once durable storage interface. Production adapter with database-enforced lease fencing, hash checking and crash replay remains part of commissioning; the in-test in-memory implementation is not durable proof.

## Google Drive / persistence
- SWLC previously returned PostgreSQL SQLSTATE 57P03 despite control plane indicating ACTIVE_HEALTHY.
- Google Drive can hold encrypted immutable recovery snapshots, evidence bundles and handoffs; not a transactional ledger or live bank/wallet credential vault.
- SHADOW recovery and backup branches: https://github.com/bookieandco/crispy-waddle/pull/1149 and https://github.com/bookieandco/crispy-waddle/pull/1148.
- Do not assert any real paper cycle persisted, any original SHADOW ledger recovered, bank transfer settled or Phantom on-chain transfer happened without verified readback/restore receipts.

## Next sequence: PURSE-AUTO.09–.13
09. Recover original durable ledger, commission PostgreSQL and append-once fenced cycle store; isolated encrypted Drive restore.
10. Replay and quarantine historical paper grades; prove memory influences later **out-of-sample** decisions with costs/slippage and causal audit.
11. Commission paper owner-payday reconciliation and prepared bank/Phantom funding paths; verify actual payment provider and wallet ownership separately before any tiny owner-authorized live canary.
12. Phone dashboards for balance freshness, bank/Phantom verification, USD vs SOL/USDC, approvals, funding receipts, paper loops, quarantine and kill switch.
13. Independent multi-cycle unattended paper certification, restart/replay, maturity of all six horizons and live-provider veto proofs; keep real-money authorization as separate explicit owner action.

Statuses must stay separate: SOURCE-CERTIFIED / STORAGE-CERTIFIED / PAPER-CERTIFIED / REAL-FUNDING-CERTIFIED / LIVE-EXECUTION-CERTIFIED.
