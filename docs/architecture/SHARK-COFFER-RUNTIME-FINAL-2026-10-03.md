# SHARK-COFFER.RUNTIME.FINAL — 2026-10-03

## Completed sequence

SHARK-COFFER.RUNTIME.1 through .10 is implemented as a restart-safe, scheduler-driven runtime.

Canonical runtime:

    persisted SHARK meme assessment
      -> immutable SHARK-MONEY-02 envelope + raw market evidence
      -> durable Money FusionEvidence
      -> durable FinancialThesis
      -> durable DialecticalAssessment
      -> risk/liquidity-assessed OpportunityCandidateV2
      -> TRADE-stage MAKE IT MAKE SENSE
      -> Money validation
      -> Purse SHARK/MEME admission
      -> cross-lane Coffer capital competition
      -> Purse decision set
      -> Purse rebalance plan
      -> governed Money execution-plan/preflight evidence
      -> AutonomousTradeIntent (non-executing)
      -> existing Money mandate/risk/Action Core/permit/canary runtime

## RUNTIME.1 — durable Money research ledger

The runtime migration adds service-role-only append/read evidence tables for SHARK runtime ingress, fusion evidence, FinancialThesis, DialecticalAssessment, OpportunityCandidateV2, execution-planning packages, non-authorizing autonomous intents, and orchestration receipts.

No runtime table grants signing, custody, capital, permit, provider-submit, withdrawal, transfer, conversion, or live-trade authority.

## RUNTIME.2 — persisted SHARK assessment consumer

The canonical meme-assessment worker now writes the exact SHARK-MONEY-02 envelope plus the raw read-only market observation used by the assessment into money_shark_runtime_ingress.

Replay with identical evidence returns REPLAY. Reusing the same envelope ID with changed envelope or market evidence is a conflict.

## RUNTIME.3 — Money fusion + dialectical challenge

buildSharkCofferRuntimeResearch reconstructs the Money research path exclusively from persisted point-in-time evidence. SHARK evidence is retained by source group. A separate Money market-evidence record is added instead of turning SHARK confidence into liquidity or expected return.

Money creates the FinancialThesis and DialecticalAssessment. Unsupported/contested evidence cannot silently become a governed opportunity.

## RUNTIME.4 — automatic TRADE MAKE IT MAKE SENSE

The worker runs the universal MIMS dimensions at TRADE stage: evidence, chronology, causal logic, incentives, base rates, contradictions, and alternatives.

Base-rate debt produces REVIEW. Unresolved contradiction produces FAIL. MIMS remains advisory and can never authorize a transaction.

## RUNTIME.5 — Money risk/liquidity/edge validation

Money derives bounded opportunity economics from source quality, independently persisted raw flow/liquidity evidence, anomaly risk, and explicit policy floors. Liquidity participation caps bound maximum capital.

Thin liquidity, insufficient evidence quality, unsupported dialectic, contradiction, or inability to fund the minimum position fails closed.

## RUNTIME.6 — Coffer admission

The runtime calls the existing SHARK -> Purse adapter. LIVE_GOVERNED_INTENTS still requires TRADE MIMS PASS, zero unresolved contradictions and explicit Money live eligibility.

Rejected opportunities are durably receipted and cannot be upgraded in place by changing old evidence.

## RUNTIME.7 — automated Purse competition/rebalance

Every admitted SHARK candidate competes through the normal Purse allocator against other active cross-lane opportunities already present for that charter.

The allocator uses current Coffer treasury evidence, spendable-liquidity evidence, unified portfolio exposure, learning profiles, personality tightening, reserve limits, lane limits, correlation limits and turnover limits.

If SHARK loses the capital competition, the runtime records that outcome rather than forcing deployment. If it wins, the resulting Purse rebalance intent remains non-executing.

## RUNTIME.8 — governed execution-plan/preflight bridge

SHARK does not manufacture an execution plan or preflight. money_shark_execution_packages accepts only canonical RebalanceIntent + Money ExecutionPlan + LiveExecutionPreflight evidence with exact lineage and economics binding.

The package must remain EXECUTION_PLANNING_EVIDENCE_ONLY, canExecute=false. The preflight must remain PREFLIGHT_ONLY, canSubmitOrders=false and canAuthorizeLive=false.

This lets the existing Money execution planner/preflight runtime commission real provider/account/market/shadow evidence independently of SHARK.

## RUNTIME.9 — autonomous-intent handoff

When a LIVE_GOVERNED_INTENTS allocation has a matching unexpired execution package and an active user-approved autonomous mandate, the worker can construct and persist the existing AutonomousTradeIntent.

The intent is still INTELLIGENCE_ONLY and canExecute=false. Existing autonomous risk veto, Action Core child authority, entitlement, execution permit, canary, kill switch and reconciliation gates remain mandatory afterward.

## RUNTIME.10 — restart/replay certification

Tests cover immutable ingress replay, conflict detection, durable runtime-receipt replay, execution-package authority rejection, deterministic Money research, MIMS/base-rate behavior, and a two-pass restart scenario:

1. first pass reaches ALLOCATED and stops because no governed plan/preflight exists;
2. a later pass sees the same durable SHARK/Purse lineage plus a valid execution package and active mandate;
3. it resumes to AUTONOMOUS_INTENT_READY without granting execution authority.

## Production scheduler

The protected GitHub OIDC production scheduler invokes /api/internal/money/shark-coffer-runtime every five minutes on an offset cadence (3, 8, 13, ... minutes) so it does not collide with the Pump lifecycle worker.

The route uses createSchedulerServiceRoleClient(request), preserving the authenticated scheduler identity across the Supabase service proxy.

## Runtime defaults

Research-policy defaults are deliberately conservative and configurable through server environment variables:

- MONEY_SHARK_OPPORTUNITY_TTL_SECONDS: 900
- MONEY_SHARK_MIN_LIQUIDITY_USD: 25000
- MONEY_SHARK_MIN_CALIBRATION_SAMPLES: 20
- MONEY_SHARK_MIN_EVIDENCE_QUALITY_BPS: 4500
- MONEY_SHARK_MAX_LIQUIDITY_PARTICIPATION_BPS: 10
- MONEY_SHARK_MIN_CAPITAL_MINOR: 1000

These are research/admission parameters, not financial authority. Owner charter and mandate caps can only tighten the final capital/execution boundary.

## Final invariant

    SHARK discovery != Money opportunity
    Money opportunity != MIMS PASS
    MIMS PASS != Coffer allocation
    Coffer allocation != execution plan
    execution plan != preflight
    preflight != mandate
    mandate != risk clearance
    autonomous intent != execution permit
    permit != provider outcome

## External commissioning boundary

RUNTIME.FINAL completes the software orchestration. It does not claim a live DEX/broker/signing provider is commissioned when the required provider/account/credential/signer/shadow/canary evidence is absent. In that state the scheduler safely stops at ALLOCATED and retries while the opportunity remains valid.
