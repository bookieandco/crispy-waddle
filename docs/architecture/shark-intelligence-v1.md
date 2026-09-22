# Jhadina Shark Intelligence v1

## Purpose

Turn raw memecoin telemetry into a governed judgment system. The Shark layer is not a DexScreener clone and not an LLM that guesses from hype. It combines market structure, token controls, wallet behavior, social context, migration events, and historical outcomes.

## Signal pipeline

```text
Solana / DEX telemetry
        +
DEX Screener market snapshots
        +
X scanner
        +
Telegram scanner
        +
Wallet tracker / cluster engine
        +
Token-security checks
        ↓
Evidence normalization
        ↓
Shark deterministic scorer
        ↓
Hard stops + confidence + reasons
        ↓
DELIA interpretation / explanation
        ↓
paper trade / watchlist / governed action proposal
        ↓
realized outcome
        ↓
Evolution learning ledger
```

DEX Screener is an input, not the final judge. Social posts are classified before they can influence the score: memecoin signal, general crypto, news, promotion, scam-pattern, or noise. This prevents broad crypto chatter from masquerading as token-specific conviction.

## Street-smarts rules

1. Momentum without liquidity is not strength.
2. Volume without credible buyers can be manufactured.
3. Social velocity without account quality can be coordinated promotion.
4. A wallet that wins once is not automatically smart money; behavior must repeat across tokens and time.
5. Deployer behavior matters more than influencer enthusiasm when the two conflict.
6. Migration events trigger re-underwriting rather than automatic buying or selling.
7. Hard stops cannot be overridden by an LLM.
8. Learning changes statistical priors gradually; one win or loss cannot rewrite the system.
9. Every judgment retains evidence and a model version so Jhadina can later ask why she made the call.

## Learning loop

Each completed or avoided opportunity becomes an outcome record:

- win
- loss
- avoided-loss
- missed-win
- expired

The learner groups outcomes by feature bands and estimates win rate, mean return, drawdown, and expectancy. Adjustments are bounded and only become active after a minimum sample size.

## Execution boundary

The existing Solana/Jupiter/Jito code should become an execution adapter behind a governed action boundary. It must not be called directly from scanners or the scorer.

```text
scanner → intelligence → decision → action proposal → policy gate → executor
```

The executor should receive a fully formed, signed-action proposal with limits supplied by policy. Private keys remain outside the intelligence package.

## Next adapters

- `DexScreenerAdapter`: market/pair snapshots and liquidity/volume deltas.
- `SolanaLaunchAdapter`: new-pool and migration events. Solana `logsSubscribe` supports a single `mentions` pubkey filter per subscription, so multiple programs require separate subscriptions. citeturn0search0
- `WalletIntelligenceAdapter`: deployer, early-buyer, funding-source, cluster and repeat-behavior signals.
- `XSignalAdapter`: token-specific social velocity and account-quality features.
- `TelegramSignalAdapter`: channel/message velocity and coordinated-promotion features.
- `TokenSecurityAdapter`: authority, holder, liquidity-control and transfer-risk evidence.
- `SharkOutcomeLedger`: persistent learning outcomes and calibration metrics.

## Safety posture

v1 should support discovery, scoring, paper execution, alerts and governed action proposals before enabling unattended live execution. The intelligence layer must be useful even when the execution adapter is disabled.
