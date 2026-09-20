# MONEY-FOREX-01 — FX Reality Core

## Objective

Add a first-class foreign-exchange reality model to Money Core.

Before this phase, Money Core recognized `FOREX` as an asset class but had no canonical representation for currency identity, base/quote semantics, pips, spot quotes, cross-rate reconstruction, session overlap, rollover/carry, or currency-specific macro context.

MONEY-FOREX-01 fills that gap while preserving the same point-in-time and non-execution boundaries used by the stock reality layer.

## Canonical flow

```text
CURRENCY REALITY
    +
CURRENCY REALITY
    |
    v
FX PAIR DEFINITION
    |
    +--> DIRECT QUOTES
    |
    +--> CROSS-RATE DERIVATION
    |
    +--> SESSION / OVERLAP STATE
    |
    +--> POLICY-RATE DIFFERENTIAL
    |      + PROVIDER SWAP / ROLLOVER
    |
    +--> BASE-CURRENCY MACRO CONTEXT
    |
    +--> QUOTE-CURRENCY MACRO CONTEXT
    |
    v
POINT-IN-TIME FX MARKET SNAPSHOT
```

## Currency identity

`FxCurrency` binds a currency to:

- canonical currency ID;
- three-letter uppercase code;
- name;
- currency kind;
- jurisdiction;
- central-bank identity when applicable;
- settlement calendar;
- minor units;
- evidence and provenance.

Jurisdiction and central-bank identity are explicit because FX is intrinsically a relationship between two monetary regimes.

## Pair semantics

`FxPairDefinition` makes base/quote direction unambiguous.

For `EUR/USD`:

- EUR is base;
- USD is quote;
- a price is USD per EUR.

The pair also fixes:

- canonical instrument ID;
- venue/market;
- deliverable vs NDF market type;
- settlement currency;
- settlement lag;
- display/price precision;
- pip size;
- minimum price increment;
- standard lot size in base-currency units;
- evidence/provenance.

The canonical Money instrument must have `assetClass = FOREX` and must match the pair's instrument, venue, quote currency, and settlement currency.

## Direct quotes

`FxQuote` carries:

- bid and ask;
- base/quote identity;
- observed, available, and received timestamps;
- provider;
- direct-vs-derived status;
- source quote IDs for derived crosses;
- evidence/provenance.

Crossed quotes fail closed.

Historical selection uses `availableAt`, so a quote that exists in storage but was not yet available at the historical information cutoff cannot leak into the snapshot.

## Exact decimal reconstruction

Cross-rate derivation uses fixed-point decimal arithmetic backed by `bigint`.

It does not multiply or invert source rates with ordinary binary floating-point arithmetic.

The output is rounded to the target pair's declared price precision.

This matters because canonical FX reality should not gain avoidable binary-float noise while composing or inverting rates.

## Cross rates

`buildFxCrossQuote()` reconstructs a target pair through an explicit bridge currency.

Example:

```text
EUR/USD × USD/JPY -> EUR/JPY
```

Source legs may also be inverted when the stored pair direction is opposite the required orientation.

The derived quote records:

- both source quote IDs;
- the union of source evidence;
- latest source observation time;
- derivation availability/receipt time;
- Money Core's cross-rate provider identity;
- independent provenance.

Cross construction fails if:

- the bridge equals target base or quote;
- one source quote is reused twice;
- a source quote is unavailable at the historical cutoff;
- derivation occurs before source receipt;
- a required source orientation cannot be established;
- the resulting market is crossed.

## Sessions and overlaps

`FxTradingSession` represents absolute session windows rather than assuming static wall-clock hours.

This keeps daylight-saving and holiday handling outside the core arithmetic and lets a calendar/provider resolve the actual session window first.

A point-in-time FX snapshot may contain multiple active sessions simultaneously. This explicitly represents overlap periods such as London/New York rather than forcing one global session label.

## Carry and rollover

`FxCarryObservation` keeps two distinct ideas together but separate:

1. monetary-policy rate differential;
2. provider-specific long/short swap points.

The policy differential is derived as:

`base policy rate - quote policy rate`

Provider swap points are retained exactly as reported and are not assumed to equal the policy-rate differential.

The record also carries:

- swap point unit;
- rollover timestamp;
- triple-rollover weekday;
- provider;
- point-in-time timestamps;
- evidence/provenance.

This avoids treating theoretical carry and broker financing as the same thing.

## Macro / jurisdiction binding

Each side of the pair receives its own `FxMacroContext`.

The context binds:

- currency;
- jurisdiction;
- central bank;
- Macro Core snapshot;
- macro artifact IDs;
- evidence/provenance.

A macro snapshot later than the FX information cutoff is rejected.

A production FX market snapshot requires both base and quote macro contexts. This ensures the pair is modeled as a comparison of two monetary regimes rather than as a bare price series.

## Point-in-time snapshot

`FxMarketSnapshot` selects only state knowable at its explicit `informationCutoff`.

It includes:

- pair/instrument identity;
- selected quote;
- spread in canonical pips;
- all active sessions at the cutoff;
- latest known carry/rollover state when available;
- base-currency macro context;
- quote-currency macro context;
- evidence manifest;
- methodology;
- snapshot hash.

Future quotes are excluded even when they are passed into the builder.

## Authority boundary

FX reality is not an FX trading bot.

Every snapshot fixes:

```text
researchAuthority = INTELLIGENCE_ONLY
executionAuthority = NONE
financialAuthority = NONE
```

No quote, spread, cross rate, session overlap, policy-rate differential, swap point, or macro observation can authorize an order.

Later forecast/opportunity layers must still pass Money Core risk, capital, policy, authority, Action Core, execution-permit, and reconciliation gates.

## Implementation

- `packages/money-core/src/fx-market-reality.ts`
- `packages/money-core/src/fx-market-reality.test.ts`
- public export through `packages/money-core/src/index.ts`

## Acceptance criteria

MONEY-FOREX-01 is structurally complete when:

1. currencies have jurisdiction/calendar/provenance identity;
2. base and quote semantics are explicit;
3. canonical Forex instruments must match their pair definitions;
4. quotes reject crossed state and preserve point-in-time timestamps;
5. pip and price-increment conventions are explicit;
6. cross rates preserve source lineage and support source inversion;
7. cross-rate arithmetic avoids ordinary binary floating-point multiplication/inversion;
8. multiple active sessions can coexist in a snapshot;
9. policy-rate differential and provider swap points remain distinct;
10. both currency macro contexts are bound at the historical cutoff;
11. future quote/macro state cannot leak into a historical snapshot;
12. every resulting snapshot is intelligence-only and non-executable.

## Next

**MONEY-FOREX-02 — FX Intelligence Fusion**

Build research intelligence on top of this reality layer:

`FX snapshot + macro differential + carry + cross-pair context → factors/regime → probabilistic forecast → stress/liquidity → outcome resolution → calibration`

It should mirror the clean reality/intelligence split established by MONEY-STOCK-01/02.
