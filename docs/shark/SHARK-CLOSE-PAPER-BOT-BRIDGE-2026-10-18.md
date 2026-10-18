# SHARK-CLOSE.01–.03 and MemeBot / SniperBot research bridge

**Date:** 2026-10-18  
**Repository:** `bookieandco/crispy-waddle`  
**Study:** `JHADINA-MEME-20261013-7D-001`; immutable data branch `experiments/meme-20261013-seven-day-001`  
**Hard cutoff:** 2026-10-20T22:50:00Z

## Preserve the canonical architecture

`@jhadina/shark-intelligence-core` remains the evidence/intelligence core.
SHARK emits evidence and **DEFER/DECLINE/ASK** research proposals. The already
existing Money policy, Action gateway and Coffer signer boundaries govern any
future live execution. Do not create parallel signing engines, funding stores,
risk-policy bypasses, launch executors or duplicate proprietary score engines.

- `ops/meme/threshold_reconciliation.py` compares each new observation against
  the **earlier highest observation of that exact mint AND pair** for price or
  reported USD liquidity valuation. It identifies each first 70%+ crossing per
  mint and risk kind. It recomputes the full ledger digest chain before returning
  warnings, supplies timestamp and source-event lineage, and emits a stable
  alert ID (`SHA256(schema|mint|risk_kind)`). An acknowledgement list, if
  provided, is read-only. The notification caller remains responsible for
  durable acknowledgement storage and for checking Actions run health.
- Its historical peak window differs from `inspect_observation()`, which
  compares the **immediately previous selected sample**. An absent immediate
  flag does not necessarily mean broken collection logic. Neither USD liquidity
  valuation decline nor price decline proves real LP token withdrawal.
- `ops/meme/paper_bot_handoff.py` emits an intentionally non-executable
  `PAPER_SNIPE_REVIEW` or `PAPER_LAUNCH_REVIEW` receipt bound to a real,
  hash-verified market observation. Both targets have `canTrade`, `canLaunch`,
  `canSign`, `canBroadcast`, `canSpend`, `canChangePolicies` set to false.
  It neither imports a real bot nor invokes a network API or wallet.
- `ops/meme/cutoff_proof.py` is a terminal guard: after the actual study
  cutoff, exact one `END`, status `COMPLETED`, full ledger digest validity,
  and byte-for-byte current-main final evaluator report match are required.
  The scheduled collector now fetches and checks the **persisted data-branch
  report and ledger after push** before attempting to disable itself.
  Failure leaves the workflow eligible for independent health-guard review.
  GitHub Actions' actual enabled/disabled state must be checked separately.

## Future MemeBot and SniperBot commissioning (NOT enabled)

1. **SHARK-BOTS.PAPER.01–.04 — research adapters:** Map the real canonical
   MemeBot launch planner and SniperBot entry/exit/migration observer to
   versioned SHARK evidence references; produce reproducible shadow-only
   candidate decisions and *simulated* token-launch plans. No wallet/signing.
2. **SHARK-BOTS.SIM.05–.08 — realism gates:** historical replay then sealed
   prospective out-of-sample runs; fees, slippage, sandwich/MEV exposure,
   execution failure, sellability uncertainty, gas, downtime and liquidity
   censoring; compare to abstention and flat cash. Never infer executable P&L
   from DexScreener or Jupiter indicative data.
3. **SHARK-BOTS.GOVERNANCE.09–.12 — commissioning evidence:** authorize only
   through separate explicit operator-approved and reversible grants:
   hardware/isolated signer and funding, asset/chain/network scope, max
   per-operation spend, total exposure/daily loss, deployment cost,
   emergency kill switch, independent audit log, post-restart recovery,
   alerting and tested revoke. No unrestricted token minting or market orders.
4. **Only after a separately approved live canary:** Stage scoped automation
   through the canonical Money/Action/Coffer route, with automatic suspension
   upon missing evidence, authorization expiry, policy conflicts or outages.
   Launches require transparent tokenomics, accurate public disclosures,
   security reviews and applicable legal/compliance checks; no deceptive
   liquidity removal, self-dealing fake volume, undisclosed mint privileges
   or investor misrepresentation.

## Current exclusions and blockers

The seven-day study remains **RESEARCH_ONLY**, with zero signing, purchases,
deployments or orders. An indicative USD liquidity drop is NOT A CONFIRMED RUG
and NOT TRADING ADVICE. On-chain liquidity withdrawals, mint/freeze/Token-2022
extensions, LP ownership and actual sellability remain partially unverified.

Canonical Money ingress also remains blocked by SWLC read-only/storage
constraints, required migration and identity/actor graph evidence (issue #1257).
Do not delete source data, enable the production scheduler, fund a wallet,
approve charges, or upgrade a service as part of this branch.

**Acceptance:** source-only PR, all `ops/meme/test_*.py` tests green,
independent health workflow preserved, no historic ledger rewrite. Actual
October 20 closure, workflow retirement, phone/runtime acceptance, bot
commissioning and future live authorizations remain separate evidence gates.
