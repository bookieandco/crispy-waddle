# MONEY-SHARK-POSITION-ALPHA-01 — Cross-domain alpha and open-position re-underwriting

## Objective

Fold the September 26 Money/SHARK research thread into the canonical Money Core and SHARK architecture.

The system must not stop reasoning after entry. Every open position may be re-underwritten from the current executable state and current evidence so the system can weigh the pros and cons of:

- adding to a position that is already winning;
- holding current exposure;
- trimming or exiting to preserve capital/profit;
- hedging correlated thesis risk; or
- rotating capital toward a materially stronger opportunity.

The same intelligence must also be reusable across domains without turning one domain's observation into another domain's truth or execution authority.

## Covered domains

The canonical alpha/position layer covers:

- stocks;
- forex;
- SHARK / meme trading;
- crypto;
- sports betting;
- prediction markets, including Kalshi/Polymarket-style event contracts.

Future domains may plug in through the same evidence and position contracts rather than creating a second control plane.

## New Money Core primitives

### `cross-domain-alpha-router.ts`

A source-domain signal is represented as governed `AlphaEvidence` with:

- source domain and subject;
- feature class (mispricing, momentum, news latency, liquidity, volatility, order flow, model disagreement, correlation, regime, settlement, risk);
- direction, strength and confidence;
- event-time / availability-time / expiry;
- immutable evidence references; and
- `authority: INTELLIGENCE_ONLY`.

`routeAlphaAcrossDomains()` can project that evidence into another Money domain, but the route explicitly carries:

- `targetTruthClaim: false`;
- `canAuthorizeLive: false`;
- `canExecute: false`; and
- an independent-target-validation requirement for cross-domain transfers.

Example: a sports lineup/injury/market-latency signal may become relevant evidence for a related prediction contract, sportsbook market, public stock, FX pair or meme narrative. It does not become a price target or trade by itself.

### `position-management.ts`

`evaluateOpenPosition()` re-underwrites an already-open position from current evidence.

Inputs include:

- current executable add/exit prices;
- realized position state and current/peak unrealized P&L;
- after-cost incremental edge;
- thesis strength;
- invalidation risk;
- liquidity quality;
- momentum;
- correlation/thesis concentration;
- better alternative opportunities; and
- routed cross-domain alpha.

Outputs are:

- `ADD`
- `HOLD`
- `TRIM`
- `EXIT`
- `HEDGE`
- `ROTATE`

Every decision preserves explicit `pros`, `cons`, and reason codes.

A winning position is never automatically held or increased merely because it is green. Adding requires fresh incremental edge, sufficient thesis strength, adequate liquidity, acceptable invalidation risk and acceptable correlation risk.

Likewise, a profitable position can become a trim/exit candidate when the edge is priced away, risk rises, liquidity deteriorates or too much peak profit has been given back.

## Sports / prediction-market behavior

A game or event that is currently winning is re-underwritten as a new decision.

Example flow:

```text
open wager / event position
        ↓
current score / game state / lineup / injury / clock
        ↓
current executable odds or event-contract book
        ↓
fresh fair probability
        ↓
fees + spread + slippage + fill probability
        ↓
remaining incremental edge
        ↓
correlated exposure / thesis risk
        ↓
ADD | HOLD | TRIM | EXIT | HEDGE | ROTATE
```

The question is not "am I winning?"

The question is:

> At the current executable price and current evidence, would increasing, maintaining or reducing this exposure improve expected portfolio value after costs and risk?

This keeps forecast skill separate from trading skill and win rate separate from economic value.

## SHARK / meme trading

SHARK now exposes `reviewMemePosition()` as an execution-agnostic position review.

It combines:

- current and peak price;
- liquidity and liquidity deterioration;
- momentum;
- tracked-wallet distribution;
- risk;
- thesis strength;
- incremental edge;
- correlation risk;
- optional cross-domain alpha references; and
- the existing deterministic profit-taking planner.

SHARK may therefore recommend `ADD`, `HOLD`, `TRIM`, or `EXIT`.

It still has:

- `financialAuthority: NONE`;
- `walletSigningAuthority: NONE`;
- `canExecute: false`; and
- `requiresMoneyCoreReview: true`.

Money Core remains capital/risk/execution authority.

## Automation and manual control

The position layer supports four policy modes:

- `MANUAL_ADVISORY`
- `PAPER_AUTOMATED`
- `SHADOW_AUTOMATED`
- `LIVE_AUTONOMOUS_GOVERNED`

The first three are non-live by construction.

`LIVE_AUTONOMOUS_GOVERNED` still produces only a `LIVE_INTENT_CANDIDATE`. It does not bypass the existing Money Core mandate, Action Core authority, hard risk limits, provider/account entitlement, execution permit, live canary, kill switch, reconciliation or accounting requirements.

The user can therefore:

1. inspect the same position review manually;
2. override or decline a suggested action through the normal governed path; or
3. opt a narrowly scoped strategy into the existing bounded autonomous mandate system.

## Bet Alpha / cross-domain reuse

"Bet Alpha" is treated as a reusable evidence family, not a sports-only feature.

Examples of legal transfers:

- sports injury/lineup surprise -> prediction-market repricing hypothesis;
- prediction-market news-latency signal -> stock/FX event-risk research;
- broad risk-on/risk-off regime -> sports/prediction liquidity and SHARK risk context;
- SHARK liquidity/order-flow observations -> crypto/meme risk features;
- model-disagreement and calibration telemetry -> domain-specific ensemble weighting.

Cross-domain signals may inform research, ranking, stress tests and open-position re-underwriting. They cannot silently create target-domain truth, fair value, capital authority or execution permission.

## Research lessons incorporated from this thread

The architecture incorporates the following research lessons:

- market-implied price is not automatically true probability;
- win rate alone does not establish profitability;
- forecast skill, selection skill, pricing skill, sizing skill and exit skill must be measured separately;
- actual fills, queue position, depth, fees, slippage and adverse selection matter;
- correlated positions can be one hidden thesis risk;
- profitable screenshots must not replace full-account history;
- strategy/model changes require version splits rather than rewriting prior history;
- rejected/skipped trade counterfactuals are useful for evaluating the governor;
- information latency is only valuable when a capturable executable window remains;
- venue selection can materially change realized results;
- weather/event contracts require exact settlement-source semantics;
- external AI/model confidence must be calibrated before use as a risk input.

## External references reviewed

The thread reviewed these public repositories as references:

- `quantgalore/kalshi-trading` — useful intraday terminal-distribution hypothesis; legacy Kalshi/API/backtest assumptions are not production-admissible.
- `iawais-10/kalshi-trading-bot` — documentation/product-showcase only; useful execution-gate vocabulary, no source implementation to import.
- `vivan1211/Infra-for-autonomous-trading-agents` — high-value structural reference for intercept queues, deterministic risk gates, paper/live separation, immutable config history, counterfactual rejected-trade tracking, settlement/calibration and isolated credentials. Current Kalshi adapter must still be independently updated before any provider admission.
- `else24/kalshi-market-bot` — useful simple strategy/UI baselines; checked-in runtime is primarily demo/mock and is not treated as verified live execution.

No external repository is silently promoted to a runtime dependency or treated as evidence of profitability.

## Authority invariants

1. Intelligence may propose; it may not mint authority.
2. A green position does not authorize adding.
3. A losing position does not automatically require exiting.
4. Current executable edge and portfolio risk drive re-underwriting.
5. Cross-domain evidence never becomes cross-domain truth automatically.
6. SHARK never gains protected-fund or wallet-signing authority from this work.
7. Live autonomous actions remain downstream of explicit user-approved mandates and existing hard controls.
8. Every automated action must remain inspectable as the same recommendation the user could review manually.

## Implementation receipt

Added on branch `money-cross-domain-position-alpha`:

- `packages/money-core/src/cross-domain-alpha-router.ts`
- `packages/money-core/src/cross-domain-alpha-router.test.ts`
- `packages/money-core/src/position-management.ts`
- `packages/money-core/src/position-management.test.ts`
- `packages/shark-intelligence-core/src/meme-trader/position-review.ts`
- `packages/shark-intelligence-core/src/meme-trader/position-review.test.ts`
- Money Core and SHARK public exports.

This phase creates the canonical reasoning contracts and tests. It does not claim that Kalshi/Polymarket live adapters, sportsbook executors, stock/FX brokers or SHARK wallet execution are newly commissioned by this change.
