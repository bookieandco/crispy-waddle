# SHARK-WATCHKEEPER.01 — Reference intake and independent paper coach

Status: **source-only, paper research, NOT commissioned**. No strategy rewrite,
wallet signing, transfers, swaps, SL/TP overrides, paid API or database writes.

## Source inventory (owner supplied October 14, 2026)

- AxisBotV2/solana-sniper-bot, commit 142fc4b2377d2bdc2559e3d121e63a15ad3324fe:
  README, promotional images and minimal language files. Fast snipes, copy
  trade, fees, safety and strategy controls are marketing claims, not independently
  verifiable engine implementation. Its "License" is a liability disclaimer.
- MemeSnipe/Free-Solana-Sniper-Memecoins-Bot-2026, commit
  6b4257c6ca762795fead2a1e8e2085703f623493: README-only external
  wallet-funding service; no inspectable application implementation. No
  wallet keys, Phantom connection or SOL transfers authorized.
- ArgaAAL/slippage-prediction-engine, commit
  b7f2131ec88593b63bc45c552a4ea7d37449de91: genuine CCXT-based
  CEX order-book data collection and simulated execution cost training,
  Python ML, ONNX. Target labels are from a simulator and do not verify
  actual fills. Binance/Kraken/Coinbase/OKX CEX order books are not
  PumpSwap/Raydium AMM or Pump.fun curves. No root license file observed;
  **no code copied or dependency imported**.
- Soul Sniper owner video: 0.02 SOL sample size, 10% stop and target,
  1000-second timeout, filters for top holders, bundled trading, same-block
  buys, mint/freeze authorities, mutable metadata and DEX coverage.
  UI-hidden slippage/priority fees still exist economically. Not validated
  as trustworthy code, custody, actual returns, safe exits or latency.
  Permissive "100" filters must NEVER be imported as safe defaults.
- Owner-provided beekeeper video: periodic agent health scorecard ->
  cheap classifier -> optional frontier strategy coach -> logged proposal.
  The video asserts costs, results and adoption without supplied primary
  verification. Useful boundary: **coaching can propose research changes,
  but cannot mutate money risk limits or independently self-deploy rules**.

## Already built in Jhadina

- packages/money-core/src/dex-route-gate.ts: stale quote, slippage,
  impact, fee, liquidity, provider and risk-halt checks.
- ops/meme/paper_shadow_lab.py: no-sell NO_FILL and provenance-aware
  counterfactual-only simulation. No wallet.
- packages/money-core/src/autonomous-strategy-learning.ts: simulation
  calibration, learning-only authority and hard-limit mutation refusal.
- packages/shark-intelligence-core/src/meme-trader/rug-self-protection.ts:
  deterministic risk defense cannot be lowered by a model.
- ops/meme/experiment_7day.py: real half-hour-ish observations, NOT
  seconds-fast launch listener or independently verified fill record.

## New exact target and limits

ops/meme/strategy_watchkeeper.py consumes owner-supplied *matched*,
prospectively sealed DEX_ROUTE_COUNTERFACTUAL candidate/baseline observations
for one regime. It rejects spot pseudo-P&L, future data, duplicated case
and quote identities, unsafe authority, bogus costs and invalid exits.
Unscored/NO_FILL exits remain censored, never invented wins.

A descriptive matched net-return difference and normal-approximation interval
can flag simulation underperformance ONLY if >=30 independent paired cases,
>=80% matched coverage, independently verified safety and zero NO_FILL cases.
These sample sizes are conservative heuristics, not financial certification.
Outputs: ABSTAIN, MONITOR_SIMULATION or PROPOSE_STRATEGY_REVIEW.
All results explicitly set canExecute, canSign, canBroadcast, canRewriteRules,
canChangeHardLimits and canAuthorizeLive FALSE. Receipt SHA256 is
deterministic content linkage, NOT an external witness or digital signature.

Usage with independently grounded local scorecard:
python ops/meme/strategy_watchkeeper.py --scorecard /private/review.json --out /private/review-result.json

Sixteen hermetic tests: python -m unittest discover -s ops/meme -p 'test_strategy_watchkeeper.py' -v

## Blocking reality

The current Oct 13–20 pilot has ZERO paper fills. Its 24h spot markouts
MUST NOT be converted to paired DEX fill outcomes for this module.
Swlc Supabase remains read-only and the research ingress migration is not
certified. No deployment, model API calls, live market data subscription,
strategy promotion or auto-execution are part of this PR. No real data or
account control has been touched.

Next: WATCHKEEPER.02 independently validated DEX route-cost snapshots;
WATCHKEEPER.03 sealed candidate proposal journal/human review;
WATCHKEEPER.04 forward observation and restoration. Preserve
Supabase recovery #1110, SHARK ingress #1257 and draft capacity PR #1285.
