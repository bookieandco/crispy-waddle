# MONEY-FOREX-02 — FX Intelligence Fusion

## Objective

Build a canonical research-intelligence layer on top of the point-in-time foreign-exchange reality introduced by MONEY-FOREX-01.

The separation is deliberate:

- MONEY-FOREX-01 answers **what was knowable about the FX market at the cutoff**.
- MONEY-FOREX-02 answers **what research features, regimes, forecasts, and risk views were derived from that reality**.

No artifact in this phase grants trading authority.

## Research loop

```text
POINT-IN-TIME FX REALITY
        +
RELATED FX SNAPSHOTS
        |
        v
FX FACTOR SET
        |
        v
FX REGIME ASSESSMENT
        |
        v
PROBABILISTIC FX FORECAST
        |
        v
LIQUIDITY + STRESS ASSESSMENT
        |
        v
RESEARCH-ONLY INTELLIGENCE SNAPSHOT
        |
        v
POST-TARGET RESOLUTION
        |
        v
CALIBRATION SCORE
```

## Factor model

`FxFactorObservation` supports:

- relative macro;
- carry;
- liquidity;
- session state;
- cross-pair context;
- momentum;
- volatility;
- event context;
- other research features.

Every factor is bound to:

- pair and instrument;
- base and quote currencies;
- information cutoff;
- source market-evidence references;
- source macro-artifact IDs;
- source FX-snapshot IDs;
- methodology version;
- evidence and provenance.

This prevents a factor from quietly citing a future or nonexistent cross-pair observation.

## Deterministic reality-derived factors

MONEY-FOREX-02 initially derives objective measurements already present in MONEY-FOREX-01:

1. spread in pips;
2. active-session count;
3. session-overlap indicator;
4. base-minus-quote policy-rate differential when carry context exists;
5. provider long-swap points;
6. provider short-swap points;
7. whether the canonical quote itself was cross-derived.

These remain measurements, not buy/sell instructions.

No arbitrary directional score is assigned where interpretation depends on a model or market regime.

## Cross-pair intelligence

`buildFxFactorSet()` can receive related FX snapshots.

Examples:

- EUR/USD research referencing USD/JPY;
- AUD/USD research referencing CNH or commodity-sensitive pairs;
- triangular consistency research involving EUR/USD, USD/JPY, and EUR/JPY.

Related snapshots must have information cutoffs no later than the primary pair's cutoff.

A factor may cite a related snapshot only when that exact snapshot was admitted to the factor set.

The same rule applies to evidence and macro-artifact lineage.

## Regime assessment

`FxRegimeAssessment` gives models an explicit place to state a contextual interpretation without rewriting raw factors.

The current vocabulary includes:

- base-rate advantage;
- quote-rate advantage;
- session overlap;
- tight liquidity;
- wide liquidity;
- trend;
- range;
- event risk;
- mixed;
- unknown.

A regime must cite factor IDs that actually exist in its factor set.

Confidence is bounded to 0–1 and is research confidence, not financial authority.

## Forecast distribution

`FxForecastDistribution` preserves:

- factor-set lineage;
- regime lineage;
- market-snapshot lineage;
- model ID/version;
- methodology version;
- issue timestamp;
- absolute target timestamp;
- named horizon;
- scenario probabilities;
- expected return per scenario;
- optional non-overlapping return ranges;
- calibration state and prior score;
- evidence;
- input-snapshot hash;
- provenance.

Probabilities must sum to one.

Scenario ranges cannot overlap.

The target must be later than issuance, and issuance cannot occur before the information cutoff.

## Liquidity and stress

`FxRiskAssessment` attaches:

- observed spread in pips;
- liquidity-risk classification;
- optional volatility estimate;
- optional downside estimate;
- explicit stress scenarios.

FX stress scenarios can record:

- shocked return;
- spread shock in pips;
- carry-differential shock in percentage points;
- rationale;
- evidence.

This makes central-bank surprises, liquidity gaps, session transitions, and carry shocks first-class research cases without converting them into automatic trades.

## Research-only Money boundary

The combined `FxIntelligenceSnapshot` creates:

```text
DecisionCase.status          = RESEARCH_ONLY
DecisionAssessment.disposition = RESEARCH_ONLY
DecisionAssessment.authorityStatus = MISSING
financialAuthority = NONE
```

Therefore it cannot satisfy Money Core's existing `assertProposalEligible()` gate.

A later execution workflow must independently establish instrument resolution, current market state, risk, capital, policy, approval/authority, execution permit, attempt, and reconciliation.

## Price resolution

FX reference and resolved prices remain decimal strings.

`fxReferenceMidPrice()` derives the midpoint using fixed-point decimal arithmetic instead of binary floating-point price math.

`resolveFxForecast()` computes realized return from fixed-point decimal prices after the forecast target.

Resolution before the target fails closed.

A named authority, rule version, evidence, and provenance are mandatory.

## Calibration

`scoreFxForecast()` records:

- multiclass Brier score when the realized return maps to one modeled scenario;
- absolute expected-return error.

Scoring cannot occur before resolution.

Historical forecasts and resolutions remain immutable inputs to later calibration work.

## Authority invariant

All major FX intelligence artifacts remain:

```text
FxFactorSet.financialAuthority          = NONE
FxRegimeAssessment.financialAuthority   = NONE
FxForecastDistribution.financialAuthority = NONE
FxRiskAssessment.financialAuthority     = NONE
FxIntelligenceSnapshot.financialAuthority = NONE
```

MONEY-FOREX-02 is research intelligence only.

## Implementation

- `packages/money-core/src/fx-intelligence-fusion.ts`
- `packages/money-core/src/fx-intelligence-fusion.test.ts`
- export through `packages/money-core/src/index.ts`

## Acceptance criteria

MONEY-FOREX-02 is structurally complete when:

1. FX factors preserve pair/currency/cutoff lineage;
2. related-pair snapshots later than the primary cutoff fail closed;
3. unknown evidence, macro artifacts, and snapshot lineage fail closed;
4. deterministic spread/session/carry factors derive from canonical FX reality;
5. regime assessments cite real factors;
6. forecast probabilities normalize to one;
7. forecast ranges cannot overlap;
8. risk/stress includes FX-specific spread and carry shocks;
9. combined intelligence is RESEARCH_ONLY with missing authority;
10. proposal eligibility remains impossible from intelligence alone;
11. resolution cannot happen before forecast target;
12. scoring cannot happen before resolution;
13. outcome scoring produces calibration evidence.

## Next

**MONEY-R1C — Action Core convergence**

With stock and FX reality/intelligence now separated cleanly from execution, the next cross-cutting repair should remove the remaining dual financial-action authority model and converge Money execution on:

`ActionRequest → Policy → Approval/Authority → ExecutionPermit → Attempt → Reconciliation`

That work should preserve these stock/FX research boundaries rather than granting them a new execution path.
