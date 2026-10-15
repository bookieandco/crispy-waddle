# WATCHKEEPER.08 — Offline SHARK Shadow evidence bridge

**Scope:** paper-only reconciliation. No trading, signing, wallet, LLM calls,
strategy mutation, credential access, external APIs, billing or database writes.

## Inputs
- Original seven-day experiment JSON state from the observation pilot,
  including hash-chained SHADOW_NO_TRADE_DECISION and optional
  SHADOW_SPOT_GRADE / SHADOW_SPOT_CENSOR events.
- WATCHKEEPER.07 offline research batch and locally recomputed SHA256
  receipts. EXTERNAL_PAPER_RESEARCH claims are not independently verified.
- Explicit join manifest binds the exact observer chain head, replay digest,
  as-of time, existing shadow decision IDs and paper case IDs. A linked
  paper result must have the same mint and trading pool as the prospective
  shadow decision. Stale, backdated or future exits, synthetic research
  and single-RPC-only outcomes fail closed.

## Output
- RESEARCH_RECONCILIATION_ONLY, spot outcomes kept separate from
  counterfactual simulated returns, open/no-sell counts, evidence references.
- No promotion to .04's forward-performance grade; a matched, independently
  witnessed prospective record is still absent.
- Every output sets actualTradesVerified=0, independentPaperFillCount=0,
  canExportAsWatchkeeper04Outcome=false, canProposeRuleChange=false,
  canAuthorizeLive=false, canExecute=false, canSign=false,
  canBroadcast=false and canRewriteRules=false.
- Hash chains establish self-consistency, not independent authenticity.
  One public RPC context cannot prove LP control, sellability or fees.

## Offline usage
    python ops/meme/shadow_evidence_bridge.py \
      --observer-state /private/experiment.json \
      --paper-batch /private/paper-results.json \
      --link-manifest /private/linked-cases.json \
      --out /private/shadow-link-review.json

Inputs remain unchanged; output refuses overwrite. Test suite runs under
existing GitHub SHARK safety/paper CI and uses synthetic/mocked observations.

## External blockers
Real independent fee and two-sided sellability evidence, prospective quote
witnessing, full Supabase backup/restore and database quota recovery (#1110,
#1257). The October 13–20 experiment does not have certified entry/exit
paper fills; never backfill or invent them to satisfy n=30.
