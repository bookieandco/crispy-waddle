# SHARK meme source fold — 2026-10-03

Status: **research/paper/shadow only; no live authority added**

## Inputs folded

This batch records four source families reviewed in the active SHARK migration/sniper work:

1. `harutocodes/pumpfun-copytrade` — Pump.fun/PumpSwap websocket fill tracking, paper-mode architecture, migrated-curve routing reference.
2. `SmithiiDev/smithii-sdk-skill` — Pump.fun/PumpSwap/Jito API-surface reference; private-key orchestration is not adopted into Jhadina custody.
3. User-provided Binance early-gainer tutorial transcript — imported technical/momentum hypothesis.
4. User-provided Pump.fun social-trading tutorial transcript — imported native trending/followed-trader/callout hypothesis.

All strategy claims remain hypotheses until point-in-time replay and shadow execution evidence support them.

## New candidate strategy: EARLY_GAINER_TREND_CONFIRMATION

Imported source hypothesis:

- prefer relatively small early gainers over already-expanded movers;
- inspect a higher-timeframe trend;
- use lower-timeframe volatility/pullback context;
- require momentum confirmation before considering entry.

SHARK representation:

- `venueSessionGainFraction`
- `higherTimeframeTrendQuality`
- `lowerTimeframeMeanReversionSetup`
- `lowerTimeframeMomentumConfirmation`
- `exitLiquidityScore`

The source's 2–5% gainer range is retained only as an imported experiment. It is not a production threshold. Indicator alignment must be tested against simple momentum and random-entry baselines, with fees, spread, slippage and multiple-testing penalties.

## New candidate strategy: PUMPFUN_SOCIAL_FLOW_CONFIRMATION

Imported source hypothesis:

- Pump-native trending surfaces can reveal accelerating attention;
- followed-trader buys/sells and callouts can add context;
- holder information may help discriminate quality;
- notification latency matters.

SHARK representation:

- `pumpTrendingAccelerationScore`
- `followedTraderIndependentFlowScore`
- `calloutEvidenceQualityScore`
- `holderIndependenceScore`
- `copyClusterConcentration`
- `trackedActorExitPressure`
- `promotionConflictRisk`
- `exitLiquidityScore`

Public-wallet activity is never assumed independent. Existing wallet-cluster, funding-graph, actor-history and sniper-density logic must deduplicate side wallets, copy clusters and common-control actors before social flow receives positive weight.

Claims that one UI is faster than another must be measured against on-chain event timestamps. Marketing, sponsorship and affiliate claims remain provenance metadata, not evidence of execution quality.

## Migration/sniper implications

The PumpCopy reference confirms a useful architectural split:

- consume Solana websocket log notifications;
- decode actual Pump.fun fills;
- map PumpSwap AMM pool events back to their token mint;
- keep paper and live executors behind a common trade-event interface.

Jhadina should independently implement that shape in TypeScript rather than embedding the Windows/.NET bot.

The reference paper broker rejects migrated curves, so it does **not** satisfy Jhadina's migration-paper requirement. SHARK still needs a dual-venue simulator:

```
Pump bonding curve before completion
  -> migration boundary
  -> PumpSwap AMM after graduation
```

The simulator must persist the quote available at decision time, expected tokens, executable price impact, fees, priority fees, latency, route, and subsequent outcome.

## Smithii boundary

Smithii is useful as an API/reference source for Pump.fun, PumpSwap and bundle semantics. It must not bypass Jhadina's custody boundary.

Not adopted:

- raw private-key arrays behind Money/Coffer;
- vendor-backend custody/orchestration of Jhadina protected funds;
- automatic bundling or volume generation as a strategy signal;
- execution authority inferred from SDK capability.

Potentially useful:

- PumpSwap route semantics;
- Jito bundle constraints for shadow execution modeling;
- transaction-shape and fee research;
- isolated paper/shadow benchmarking.

## Required experiments

1. Compare `EARLY_GAINER_TREND_CONFIRMATION` against:
   - simple venue momentum;
   - price-only trend;
   - MACD-only;
   - Bollinger-only;
   - random eligible entries.

2. Compare `PUMPFUN_SOCIAL_FLOW_CONFIRMATION` against:
   - on-chain-only candidate scoring;
   - raw followed-wallet scoring;
   - independence-deduplicated wallet scoring;
   - trending-only scoring;
   - social signal with measured notification latency.

3. For both families record:
   - precision/recall of positive outcomes;
   - median and tail returns;
   - maximum adverse excursion;
   - executable slippage;
   - fee burden;
   - survival bias;
   - launchpad/regime dependence;
   - incremental value after SHARK rug/manipulation vetoes.

## Authority

These additions may produce research candidates and paper/shadow experiments only.

They do not:

- authorize copy trading;
- authorize live memecoin trades;
- grant wallet signing;
- bypass Money Core risk or Coffer custody;
- treat transcript profitability claims as verified facts.
