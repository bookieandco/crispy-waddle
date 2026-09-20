# MONEY-PREDICTION-01/02 — Prediction Market Reality + Intelligence

## Objective

Close the Money handoff requirement for prediction markets as a first-class research domain without turning a probability estimate, a sports forecast, or a market quote into betting or financial execution authority.

Provider-specific Polymarket/Kalshi integrations remain separate read-adapter work. This layer defines the canonical Money contracts they must populate.

## MONEY-PREDICTION-01 — Market Reality

The reality layer models:

- a canonical `PREDICTION` instrument;
- venue and provider-independent market identity;
- binary and mutually-exclusive multi-outcome contracts;
- quote and settlement currency;
- market open/close schedule;
- explicit payout amount;
- named outcomes;
- explicit resolution authority, canonical resolution rule and rule version;
- scheduled resolution/dispute window and void treatment;
- per-outcome bid/ask implied probabilities and optional displayed size;
- observed/available/received timestamps;
- point-in-time quote selection;
- complete-set probability mass and visible arbitrage state.

Future quotes are excluded by `availableAt`. Crossed quotes fail closed. A snapshot requires a quote for every defined outcome at the requested information cutoff.

Complete-set inconsistency is not silently normalized away. If all asks total below 1 the snapshot records `BUY_ALL`; if all bids total above 1 it records `SELL_ALL`.

Every market snapshot fixes:

```text
researchAuthority  = INTELLIGENCE_ONLY
executionAuthority = NONE
financialAuthority = NONE
```

### Resolution

Final outcome admission is separately bound to:

- the exact declared market and instrument;
- the declared resolution authority;
- the declared rule version;
- a resolution timestamp after market close;
- evidence and provenance.

A pending/ambiguous/void record cannot carry a winning outcome as if it were final.

## MONEY-PREDICTION-02 — Research Intelligence

The research layer compares point-in-time market-implied probability to an independently evidenced probability estimate.

It adds:

- market probability, independent probability, spread, liquidity, calibration, event and resolution-risk factors;
- exact market-snapshot lineage;
- independent-model identity/version and evidence snapshot hash;
- an explicit divergence view without equating divergence to executable edge;
- liquidity and resolution-risk assessment;
- post-resolution Brier calibration with `LEARNING_ONLY` authority;
- a Money `DecisionCase` / `DecisionAssessment` that remains `RESEARCH_ONLY`.

The resulting assessment always carries:

```text
authorityStatus = MISSING
disposition     = RESEARCH_ONLY
financialAuthority = NONE
```

so `assertProposalEligible()` continues to fail closed.

## Sports separation

A Sports Prediction artifact is not automatically a prediction-market position or instrument.

Sports may provide independently governed evidence, but the prediction-market layer must still resolve:

1. the exact market instrument;
2. the exact market/outcome quote at the information cutoff;
3. the independent estimate's evidence and calibration;
4. liquidity and resolution risk;
5. Money capital/risk/policy/authority through later canonical gates.

No sportsbook wager, market order, payment, transfer or allocation is created here.

## Implementation

- `packages/money-core/src/prediction-market-reality.ts`
- `packages/money-core/src/prediction-market-reality.test.ts`
- `packages/money-core/src/prediction-market-intelligence.ts`
- `packages/money-core/src/prediction-market-intelligence.test.ts`
- public exports through `packages/money-core/src/index.ts`

## Acceptance

1. `PREDICTION` is no longer only an enum/calibration concept.
2. Market/outcome identity and venue are explicit.
3. Resolution authority and rule version are explicit and binding.
4. Future quote evidence cannot enter a historical snapshot.
5. Crossed quotes fail closed.
6. Every defined outcome must have point-in-time market evidence.
7. Complete-set inconsistencies are exposed rather than silently normalized.
8. Independent estimates cannot use future information.
9. Factors must preserve exact market-snapshot lineage.
10. Intelligence remains research-only and cannot become proposal-eligible by itself.
11. Final resolution is required before learning/calibration.
12. Calibration has learning authority only.

## Execution boundary

This work does **not** add a Polymarket, Kalshi, sportsbook, wallet, payment, order, or automatic betting executor.

Any future live prediction-market action must independently pass canonical instrument resolution, current market reality, capital allocation, protected reserves, risk, policy, explicit approval/authority, Action Core, execution permit, execution attempt, kill switch, reconciliation and accounting.
