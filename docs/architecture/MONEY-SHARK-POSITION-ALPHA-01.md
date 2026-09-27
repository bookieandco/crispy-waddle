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


## Sports parlay intelligence — NFL workflow fold-in

The September 26 NFL parlay transcript adds a ticket-construction workflow that is now modeled explicitly rather than being reduced to single-leg SportsPaperWager records.

### Transcript patterns retained as research inputs

The source separates several ticket intents:

- a two-leg moneyline "bankroll builder";
- a two-leg points teaser using alternate spreads around key football numbers;
- a same-game parlay built around a shared low-scoring/game-control script;
- an anytime-touchdown parlay using role/usage evidence; and
- a community-selected final leg based on comment voting.

The handicap examples also reference reusable football features such as:

- early-down success/conversion efficiency;
- run-block and pass-rush win rate;
- route-area defensive weakness;
- quarterback release/rhythm profile;
- home/road and travel environment;
- pace/possession expectations;
- injury-driven workload changes;
- interior/red-zone carry share;
- high-value receiving usage near the goal line; and
- opponent coverage/matchup tendencies.

These become candidate Sports Intelligence evidence features. They are not promoted to universal betting rules merely because they appear in the source.

### New canonical contract

`packages/money-core/src/sports-parlay-intelligence.ts` adds:

- `SportsParlayTicketKind`
- `SportsParlayLeg`
- `SportsParlayDependency`
- `TeaserAdjustment`
- `CommunitySelectionSignal`
- `SportsParlayAssessment`

Supported ticket classifications are:

- `BANKROLL_BUILDER`
- `TEASER`
- `SAME_GAME_PARLAY`
- `ANYTIME_TD_PARLAY`
- `COMMUNITY_PARLAY`
- `STANDARD`

### Bankroll-builder rule

"Bankroll builder" is presentation intent, not a mathematical safety classification.

A ticket with individually high-probability legs may still:

- compound bookmaker margin;
- increase variance;
- concentrate hidden shared-factor risk; and
- be inferior to taking one leg or no position at the offered price.

Therefore every `BANKROLL_BUILDER` assessment carries `BANKROLL_LABEL_IS_NOT_RISK_PROOF`.

### Teaser rule

Teaser/alternate-line value is evaluated from both sides of the trade:

```text
points gained
+ key numbers crossed
+ new fair probability
- extra price paid
- fees / margin / execution cost
= incremental teaser edge
```

Crossing football key numbers such as 3 or 7 is recorded as evidence, not treated as automatic value.

### Same-game parlay rule

Same-game legs are not assumed independent.

`evaluateSportsParlay()` calculates the naïve product of standalone probabilities only as a diagnostic. If legs share an event, or the ticket is explicitly an SGP:

- `requiresJointModel = true`;
- a documented dependency graph is expected;
- the system records positive, negative, shared-game-script and common-driver relationships; and
- no ticket-level edge is accepted until a `jointFairProbability` is supplied.

This directly supports game-script tickets such as:

```text
competitive underdog spread
+ game under
+ correlated rushing-volume over
```

while still requiring the joint model to prove whether that story is actually priced favorably.

### Anytime-touchdown / role evidence

Touchdown propositions may ingest structured role evidence such as goal-line opportunity, red-zone carries/targets, route participation, screen usage, injury-driven role changes and matchup evidence.

Role evidence raises or lowers a model estimate; it does not create a bet by itself.

### Community-parlay rule

A top-voted community leg is captured as `CommunitySelectionSignal` with:

```text
authority = SENTIMENT_ONLY
canExecute = false
```

Popularity can be useful for:

- crowd-belief measurement;
- discovering a missed angle;
- identifying public concentration;
- testing fade/follow hypotheses; and
- measuring whether community consensus is calibrated historically.

It cannot automatically become the final leg or receive financial authority.

### Manual adjustment / tail-or-fade support

Because every proposed leg remains an evidence-backed object, the user can:

- accept the original line;
- choose an alternate line;
- remove a leg;
- fade a leg;
- compare single vs parlay economics; or
- replace a community-selected leg.

Any modified ticket is re-priced and re-underwritten rather than inheriting the source creator's confidence.

### Automation boundary

Parlay intelligence feeds the same Money position/alpha architecture added in this PR.

It may continuously:

- discover candidate tickets;
- compare offered combinations;
- estimate joint probability;
- score correlation/coherence;
- monitor changing lines;
- generate add/hold/trim/exit reasoning on open eligible positions; and
- learn from settled outcomes.

It does not bypass the existing mandate, risk, policy, capital, provider, permit, kill-switch or reconciliation boundaries.


## Additional Parlay repository audit — 2026-09-26

### `cmuparlay/parlaylib`

Disposition: **not a sports-betting/parlay library**.

ParlayLib is an MIT-licensed C++ toolkit for parallel algorithms on shared-memory multicore machines. It provides parallel sequences, algorithms, work-stealing scheduling and memory-allocation infrastructure.

Potential indirect value:
- high-throughput Monte Carlo or simulation workloads if Money Core later introduces a native C++ compute service;
- generic parallel algorithm reference.

Current decision:
- do not import it into the TypeScript Money Core merely because of the name;
- no sports-ticket, bookmaker, probability, SGP or prediction-market semantics are present;
- no runtime dependency added.

### `parlay-run/parlay-mcp`

Disposition: **strong prediction-market intelligence reference; hosted service is not admissible as an automated Money execution dependency under its current Terms**.

The public repository documents a hosted read-only MCP service exposing:
- cross-venue market search;
- market briefs;
- market discovery;
- cross-venue comparisons;
- discrepancy scanning; and
- venue inspection.

Its documented metadata model includes:
- freshness;
- venues queried / failed;
- real-money vs sentiment market type;
- match confidence;
- liquidity status; and
- risk flags.

The service currently separates Polymarket/Kalshi/Limitless real-money signals from Manifold sentiment. That separation is incorporated into Money Core's new cross-venue contract.

Important legal/operational boundary:
- the repository bundle is MIT;
- the hosted MCP implementation and outputs are proprietary;
- the hosted service Terms state it is read-only and prohibit using the service to facilitate gambling/trading automation or individualized betting/trading advice.

Therefore:
- do not wire `mcp.parlay.run` into autonomous execution or individualized trade generation without a changed license/terms or explicit written permission;
- architecture patterns may be independently implemented;
- any future open-source venue SDK or direct provider integration must be separately audited and admitted.

### New Money implementation: `prediction-cross-venue-intelligence.ts`

Money Core now has a provider-neutral cross-venue research layer with:
- `PredictionVenueObservation`;
- `PredictionCrossVenueComparison`;
- real-money vs sentiment isolation;
- match-confidence handling;
- liquidity health;
- stale-data exclusion;
- executable buy/sell probability comparison;
- settlement-rule fingerprint comparison;
- resolution-authority mismatch flags; and
- cross-venue midpoint discrepancy measurement.

A similarly worded Kalshi and Polymarket contract is not treated as the same economic instrument unless event lineage and settlement semantics are comparable.

Sentiment venues can contribute research context but cannot become executable price sources.

### `trillium/parlay`

Disposition: **not a betting/parlay engine; useful Jhadina agent-operations reference outside the Bet Alpha model**.

The project is an MIT-licensed agent chat/supervision system with:
- per-agent channels;
- durable identity/scratchpad/handoff concepts;
- agent spawning and supervision;
- event/history persistence;
- mobile/voice-first operator interaction; and
- MCP/agent-mail experimentation.

Potential Jhadina value:
- persistent long-running Money research agents;
- human-visible agent channels;
- durable handoff/resume state;
- mobile supervision of autonomous research jobs;
- explicit agent identity and task-state separation.

Cautions:
- the project documents alpha/single-owner assumptions;
- its chat API is unauthenticated by design and intended only for private network exposure;
- some documented fleet/handoff behavior depends on personal/private tooling.

Current decision:
- no Money or SHARK runtime dependency added;
- retain as a Jhadina agent-runtime/operator-interface reference rather than sports-betting logic.

## College-football handicap evidence fold-in

The attached September 26 college-football breakdown contributes a broader feature taxonomy for full-game sides and totals. The source repeatedly combines:

- team efficiency and opponent quality;
- injury/availability and roster depth;
- rushing/pass matchup structure;
- turnover and penalty discipline;
- third-down and red-zone performance;
- pace/time-of-possession;
- weather;
- travel/body-clock effects;
- home-field environment;
- historical series;
- market/sharp-money claims;
- coaching/scheme;
- player workload/role; and
- narrative/motivational claims.

Money Core now models these through `sports-handicap-evidence.ts`.

Evidence classes are separated into:
- `MEASURED`;
- `REPORTED`;
- `MARKET`;
- `HISTORICAL`; and
- `NARRATIVE`.

Narrative claims such as revenge, playing angry, style-points motivation, emotional response after a loss, or locker-room urgency are forced to `UNTESTED_NARRATIVE` status. They cannot claim direct causality until forward calibration demonstrates incremental value.

Market-flow claims such as "sharp money is on X" remain `MARKET` evidence rather than being silently treated as team-quality truth.

This allows Sports Intelligence to learn which handicapping features actually improve calibrated probabilities while preserving the source's useful structure without inheriting its rhetoric as fact.


## ParlayChain repository audit — `parlaychain/parlay`

Disposition: **legacy blockchain/wallet reference only; no sports-betting runtime dependency**.

The repository describes Parlay Chain (PAR), a 2018-era blockchain ecosystem with branded "predictor gameplay." Source inspection shows a Bitcoin/Peercoin/Darkcoin-derived node and wallet stack:
- chain parameters and P2P seeds;
- wallet/key/transaction management;
- JSON-RPC wallet methods;
- proof-of-work/proof-of-stake-era chain logic;
- PrimeNode/masternode collateral, registration and ping behavior;
- legacy Qt wallet/build infrastructure.

No modern source module was found for:
- sportsbook lines or player props;
- event-contract normalization;
- joint parlay probability;
- oracle-backed sports resolution;
- contemporary prediction-market venue adapters;
- order-book/fill modeling; or
- Money Core risk/execution governance.

The repository is MIT-licensed, but age and domain mismatch make direct reuse inappropriate. Its wallet/RPC/masternode code is not imported into Money Core or SHARK. If Jhadina ever needs blockchain-node primitives, that work should use a current, independently audited chain/library rather than reviving this stack.

## Player-prop intelligence fold-in

The attached NFL prop breakdown contributes a repeatable player-prop research process rather than only specific picks.

Recurring source mechanics include:
- receptions vs receiving-yard distinction;
- rush-attempt volume vs rushing efficiency;
- routes run, snap share, target share and first-read share;
- backfield concentration when backups are injured;
- injury-driven target/carry redistribution;
- game-script sensitivity for favorites/underdogs;
- opponent blitz/man/coverage/run-defense matchup;
- weather, especially wind/rain interaction with passing/rushing volume;
- coach-speak and reported role changes;
- buy-low reasoning after a weak prior result;
- prior closing line vs current line;
- public ticket share vs actual line movement;
- alternate yardage/attempt ladders;
- high-ceiling long-shot legs; and
- same-ticket correlation.

These are now represented in `sports-prop-intelligence.ts`.

### Prop assessment invariants

A player-prop assessment separates:
- `VOLUME` theses — opportunity/role is the main edge;
- `EFFICIENCY` theses — expected production per opportunity is the main edge;
- `MIXED` theses.

A volume thesis without explicit usage evidence is flagged.

"Buy low" is not inferred merely because the player missed last week or the current number looks cheaper. The current line must be more favorable **and** projected opportunity share must remain materially stable.

Heavy public tickets with little line movement are recorded as a market observation, but the engine explicitly sets:

```text
marketResistanceInferenceAllowed = false
```

so "the book is daring bettors" or "sharp side confirmed" cannot be silently promoted from line behavior alone.

### Alt-line / ladder rule

Each alternate rung receives its own:
- offered odds;
- fair hit probability;
- estimated costs; and
- after-cost edge test.

The engine does not assume that a profitable base line makes 80+, 100+, 125+ or other ceiling outcomes profitable.

For OVER ladders, fair hit probability must be non-increasing as the threshold rises. For UNDER ladders, it must be non-decreasing. Non-monotonic probability inputs fail back to model review.

### Interaction with parlay construction

A prop rung can become a `PLAYER_PROP` leg only after its standalone economics are evaluated. If it is combined with another leg from the same game, the existing SGP dependency/joint-probability rules still apply.

This preserves the distinction:

```text
good player-prop thesis
!= good alternate line
!= good parlay leg
!= good jointly priced ticket
```

All outputs remain intelligence-only and do not bypass sportsbook/provider, mandate, risk, policy, capital, permit, kill-switch or reconciliation boundaries.
