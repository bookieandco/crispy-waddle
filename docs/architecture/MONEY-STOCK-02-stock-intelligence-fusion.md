# MONEY-STOCK-02 — Stock Intelligence Fusion

## Objective

Turn the point-in-time reality built by MONEY-STOCK-01 and the normalized issuer fundamentals from MONEY-036 into a canonical **research-intelligence layer**.

This phase does not authorize trading.

It provides the missing chain:

```text
POINT-IN-TIME MARKET REALITY
        +
NORMALIZED FUNDAMENTALS
        +
BENCHMARK / EVENT CONTEXT
        |
        v
VALUATION + FACTOR SET
        |
        v
PROBABILISTIC FORECAST
        |
        v
RISK + STRESS CONTEXT
        |
        v
RESEARCH-ONLY INTELLIGENCE SNAPSHOT
        |
        v
OUTCOME RESOLUTION
        |
        v
CALIBRATION SCORE
```

## Separation of reality and intelligence

MONEY-STOCK-01 remains the canonical record of what the market looked like.

MONEY-035/MONEY-036 remain the canonical record of issuer-reported and normalized fundamental information.

MONEY-STOCK-02 never mutates either layer. It creates derived research artifacts with their own methodology, provenance, and information cutoff.

## Factors

`StockFactorObservation` supports:

- valuation;
- quality;
- growth;
- momentum;
- volatility;
- liquidity;
- relative strength;
- event;
- other research factors.

Every factor binds to:

- instrument and issuer;
- point-in-time cutoff;
- source fundamental metric IDs;
- source market evidence references;
- source benchmark IDs;
- methodology version;
- evidence;
- provenance.

A factor cannot cite a fundamental metric that is later than the market cutoff.

It also cannot cite a market evidence reference or benchmark that is absent from the canonical market snapshot.

## Deterministic market-derived factors

MONEY-STOCK-02 initially derives three unambiguous market features directly from MONEY-STOCK-01:

1. bid/ask spread in basis points;
2. top-of-book size imbalance;
3. trailing return across the bars present in the snapshot.

These are raw research measurements. They are not buy/sell signals.

The system deliberately does not invent a normalized directional score for measurements where the direction is methodology-dependent.

## Valuation ratios

`buildRatioFactorObservation()` provides a generic deterministic ratio primitive.

This avoids hard-coding accounting semantics that may not apply to every issuer or instrument. A methodology can explicitly construct P/E, P/B, EV/EBITDA, FCF yield, or other ratios while preserving exactly which normalized metric IDs and market observations supplied the numerator and denominator.

The ratio itself is derived; the source fundamentals remain untouched.

## Forecast distribution

`StockForecastDistribution` contains:

- model ID and version;
- methodology version;
- factor-set lineage;
- market and issuer-state lineage;
- issue time and absolute target time;
- explicit horizon label;
- scenario probabilities;
- expected return per scenario;
- optional non-overlapping return ranges;
- prior calibration status/score;
- evidence and input snapshot hash;
- provenance.

Scenario probabilities must sum to one.

The forecast target must be later than issuance, and issuance cannot predate the information cutoff.

## Risk and stress

`StockRiskAssessment` attaches research risk context to one forecast.

It can carry:

- volatility estimate;
- downside estimate;
- liquidity-risk classification;
- explicit stress scenarios.

Stress scenarios require rationale and evidence.

They do not create execution authority.

## Research decision boundary

The combined `StockIntelligenceSnapshot` creates a Money Core decision case with:

```text
status          = RESEARCH_ONLY
disposition     = RESEARCH_ONLY
authorityStatus = MISSING
```

and:

```text
financialAuthority = NONE
```

This prevents a factor score, forecast probability, expected return, stress result, or calibration score from becoming a trade merely because it exists.

Any later trade workflow must separately satisfy Money Core policy, capital, risk, approval/authority, Action Core, execution-permit, and reconciliation requirements.

## Resolution and calibration

A forecast contains an absolute `targetAt`.

`resolveStockForecast()` accepts a later canonical price observation and records:

- reference price;
- resolved price;
- realized return;
- matching modeled scenario, when one exists;
- result authority/rule version;
- evidence/provenance.

Resolution before the forecast target fails closed.

`scoreStockForecast()` produces:

- multiclass Brier score when the realized return maps to one modeled scenario;
- absolute expected-return error.

This closes the research learning loop without rewriting the historical forecast.

## Authority invariant

The following remain fixed:

```text
StockFactorSet.financialAuthority             = NONE
StockForecastDistribution.financialAuthority  = NONE
StockRiskAssessment.financialAuthority        = NONE
StockIntelligenceSnapshot.financialAuthority  = NONE
```

MONEY-STOCK-02 is therefore intelligence, not execution.

## Implementation

- `packages/money-core/src/stock-intelligence-fusion.ts`
- `packages/money-core/src/stock-intelligence-fusion.test.ts`
- export through `packages/money-core/src/index.ts`

## Acceptance criteria

MONEY-STOCK-02 is structurally complete when:

1. factors bind to point-in-time market and fundamental lineage;
2. future fundamental metrics fail closed;
3. unknown market/benchmark sources fail closed;
4. forecast probabilities are normalized;
5. forecast scenario ranges cannot overlap;
6. risk/stress remains research-only;
7. combined intelligence creates only a RESEARCH_ONLY Money decision case;
8. forecasts resolve only after their target time;
9. outcome scoring produces calibration evidence;
10. no artifact contains financial execution authority.

## Next

**MONEY-FOREX-01 — FX Reality Core**

Build the first-class foreign-exchange reality layer:

`currency identity → pair/base/quote semantics → bid/ask/spread → cross rates → sessions → rollover/carry → macro/jurisdiction bindings → point-in-time FX snapshot`

That should reuse the same provenance and non-execution principles established by MONEY-STOCK-01/02.
