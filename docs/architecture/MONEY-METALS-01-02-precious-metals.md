# MONEY-METALS-01/02 — Precious Metals Reality + Intelligence

## Objective

Close the precious-metals domain gap recorded after MONEY-R13B by making XAU, XAG, XPT, and XPD first-class Money Core research assets without granting them autonomous execution authority.

## MONEY-METALS-01 — Reality Core

The canonical reality layer models:

- metal identity: XAU / XAG / XPT / XPD;
- spot versus futures market type;
- venue;
- quote and settlement currency;
- trading unit: troy ounce, gram, or kilogram;
- purity;
- minimum price increment;
- futures expiry, contract size, and cash/physical settlement;
- bid/ask quote provenance and point-in-time availability;
- canonical midpoint and spread;
- explicit information cutoff.

Future information is excluded by `availableAt`. Expired futures fail closed at the requested cutoff. Spot instruments cannot silently carry futures contract terms.

Every reality snapshot fixes:

```text
researchAuthority  = INTELLIGENCE_ONLY
executionAuthority = NONE
financialAuthority = NONE
```

## MONEY-METALS-02 — Intelligence Fusion

The research layer adds:

- factor sets for spread, momentum, real rates, USD conditions, inflation, physical premium, inventory, futures basis, and other evidence;
- regime assessment;
- probabilistic forecast distributions;
- liquidity/stress assessment;
- a Money `DecisionCase` / `DecisionAssessment` that remains `RESEARCH_ONLY`.

Factors must cite the exact admitted market snapshot and cannot carry a later information cutoff. Forecast probabilities must sum to one and optional scenario ranges cannot overlap.

The resulting decision assessment always has:

```text
authorityStatus = MISSING
disposition     = RESEARCH_ONLY
```

so `assertProposalEligible()` continues to fail closed.

## Implementation

- `packages/money-core/src/metals-market-reality.ts`
- `packages/money-core/src/metals-market-reality.test.ts`
- `packages/money-core/src/metals-intelligence-fusion.ts`
- `packages/money-core/src/metals-intelligence-fusion.test.ts`
- public exports through `packages/money-core/src/index.ts`

## Acceptance

1. XAU/XAG/XPT/XPD are modeled as first-class metal identities.
2. Spot and futures semantics cannot be conflated.
3. Venue, unit, purity, currency, and settlement are explicit.
4. Crossed quotes fail closed.
5. Future quote evidence cannot leak into a historical snapshot.
6. Expired futures fail closed.
7. Factor evidence preserves market-snapshot lineage.
8. Future factor evidence fails closed.
9. Forecast probability mass must equal one.
10. Research output cannot become proposal-eligible or executable by itself.

## Execution boundary

This work does **not** add a metals broker adapter or automatic metals trading. Any future live metals workflow must independently pass the existing Money Core instrument, capital, risk, policy, approval/authority, Action Core, execution-permit, attempt, kill-switch, reconciliation, and accounting boundaries.
