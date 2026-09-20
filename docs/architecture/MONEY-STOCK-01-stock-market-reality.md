# MONEY-STOCK-01 — Stock Market Reality

## Objective

Complete the missing market-side half of Money Core's stock intelligence foundation.

MONEY-035 and MONEY-036 already model issuer identity, filings, reported facts, revisions, point-in-time fundamental state, and normalized accounting metrics. MONEY-STOCK-01 adds the market reality needed to join those fundamentals to what the security was actually doing at a historical information cutoff.

This phase remains **market data and research state only**. It introduces no trade proposal, allocation, order, execution permit, or broker mutation.

## Canonical flow

```text
CANONICAL STOCK INSTRUMENT
        |
        +--> MARKET SESSION
        |
        +--> QUOTE
        |
        +--> BARS
        |
        +--> ORDER BOOK
        |
        +--> CORPORATE ACTIONS
        |
        +--> BENCHMARK REFERENCES + OBSERVATIONS
        |
        v
POINT-IN-TIME STOCK MARKET SNAPSHOT
        |
        +--> ISSUER ↔ INSTRUMENT RELATIONSHIP
        |
        +--> FUNDAMENTAL STATE
        |
        v
STOCK ISSUER + MARKET FUSED STATE
```

## Instrument invariant

A stock snapshot can only be created for a canonical instrument whose:

- `assetClass = STOCK`;
- instrument, venue, quote currency, and settlement currency are explicit;
- identifiers are present;
- provenance hash is present.

Market records supplied for that instrument must match its canonical venue and quote currency.

## Quote reality

`StockQuote` records:

- bid and ask prices;
- optional bid and ask sizes;
- venue and currency;
- observed, available, and received timestamps;
- provider;
- evidence reference;
- provenance hash.

The bridge rejects:

- malformed/nonpositive prices;
- ask below bid;
- availability before observation;
- receipt before availability;
- venue/currency/instrument mismatch.

## Bar reality

`StockBar` carries OHLCV data plus:

- explicit interval start/end;
- observation/availability/receipt timestamps;
- optional trade count;
- provider/evidence/provenance;
- **price-adjustment status**.

The adjustment status is intentionally explicit:

- `UNADJUSTED`
- `SOURCE_ADJUSTED`
- `CANONICALLY_ADJUSTED`
- `UNKNOWN`

Corporate actions are therefore never silently baked into price history.

## Order-book reality

`StockOrderBookSnapshot` preserves ordered bid/ask levels and rejects:

- one-sided books;
- unsorted bid or ask ladders;
- crossed books;
- invalid sizes/order counts;
- broken point-in-time timestamp ordering.

This is a market-observation contract, not an execution book.

## Corporate actions

The canonical action vocabulary includes:

- cash and stock dividends;
- split/reverse split;
- merger/acquisition;
- spinoff;
- symbol change;
- delisting;
- tender;
- rights;
- other.

Corporate actions are selected by **when Money Core could have known them**, using `availableAt`, not merely by their future effective date.

That means an announced split with a future effective date correctly appears in a historical snapshot when the announcement was already public by the cutoff.

## Benchmarks

A stock can be associated with market, sector, industry, membership, or custom benchmarks.

Benchmark membership/reference state has its own:

- effective range;
- availability timestamp;
- receipt timestamp;
- optional weight;
- evidence/provenance.

The snapshot attaches the latest benchmark observation available at the same historical cutoff.

This establishes the substrate for later relative strength, factor, beta, sector, and attribution work without mixing those derived analytics into raw market reality.

## Point-in-time rule

Every market snapshot is built against an explicit `informationCutoff`.

Records with `availableAt > informationCutoff` are not selected.

The current session observation/effective timestamp must also not be later than the cutoff.

Future records may exist in storage and be passed to the builder, but they cannot leak into the historical snapshot.

## Issuer/fundamental fusion

`buildStockIssuerMarketState()` joins:

1. canonical stock instrument;
2. MONEY-STOCK-01 market snapshot;
3. MONEY-035 issuer-instrument relationship;
4. MONEY-035 fundamental state.

The join fails if:

- instrument IDs disagree;
- issuer IDs disagree;
- the issuer/instrument relationship was not effective at the market cutoff;
- the fundamental state's information cutoff is later than the market cutoff;
- market or fundamental provenance is missing.

The fused state records `fundamentalLagMs` so later intelligence can distinguish same-cutoff fundamentals from older reported fundamentals.

## Authority boundary

Both layers are non-executable:

```text
StockMarketSnapshot.executionAuthority = NONE
StockIssuerMarketState.financialAuthority = NONE
```

No quote, price move, order-book imbalance, corporate action, benchmark state, or fundamental metric can authorize a trade.

Those observations may later feed forecast, risk, opportunity, policy, allocation, and Action Core workflows, each through its own authority gate.

## Implementation

- `packages/money-core/src/stock-market-reality.ts`
- `packages/money-core/src/stock-market-reality.test.ts`
- public export through `packages/money-core/src/index.ts`

## Acceptance criteria

MONEY-STOCK-01 is structurally complete when:

1. stock instruments are explicitly validated;
2. quotes are two-sided and point-in-time;
3. bars preserve adjustment semantics;
4. order books reject crossed/unsorted state;
5. corporate actions use availability semantics;
6. benchmarks are effective and point-in-time;
7. future market observations are excluded from historical snapshots;
8. issuer/instrument/fundamental fusion rejects future fundamentals;
9. all resulting state remains non-executable.

## Next

**MONEY-STOCK-02 — Stock Intelligence Fusion** should build derived research on top of this reality layer:

`market snapshot + normalized fundamentals + benchmark context → valuation/factors → forecast distribution → risk/stress → resolved outcome → calibration`

That phase should consume MONEY-STOCK-01 rather than expanding raw market contracts further.
