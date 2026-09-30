# SHARK 0 — Intelligence Foundation

SHARK is the market-intelligence layer under Jhadina's Opportunity OS. Its job is to **observe, understand, compare, remember, and make disciplined decisions** — not merely produce a high score.

## Revised SHARK 0 boundary

SHARK 0 is deliberately **not an autonomous trading bot**. It establishes the contracts required for later scanners, wallet intelligence, statistical learning, and execution adapters.

### What is modeled now

- **Multi-chain wallets** — one logical wallet can contain Solana, Bitcoin, Dogecoin, Ethereum/Base, Tron, and other chain addresses.
- **Mining wallets** — mining is represented as a wallet capability/profile rather than being conflated with trading.
- **Canonical observations** — raw market, chain, wallet, social, Reddit, Telegram, news, and mining evidence enters through one observation contract.
- **Shark decisions** — decisions preserve supporting evidence, contradictory evidence, uncertainty, rug risk, and explicit "street-smart" pattern flags.
- **Outcomes** — wins, losses, rugs, missed opportunities, and unknown outcomes become learning samples.
- **Statistical learning** — feature/pattern statistics use smoothing so early luck does not become false confidence.

## Intelligence philosophy

A SHARK decision is not simply `score > threshold`.

It should eventually combine:

`market structure + liquidity + wallet behavior + creator history + social velocity + source credibility + contradictions + regime + historical outcomes + street-smart patterns`

The "street-smart" layer is a structured evidence system: repeated suspicious behaviors can raise risk even when conventional metrics look attractive. It must remain explainable and auditable rather than becoming an opaque personality score.

## Safety boundary

Private keys and signing material never belong in SHARK intelligence records. Wallet records contain custody references and public addresses only. Execution authority remains downstream behind Jhadina's authorization/safeguard boundary.

The eventual architecture is:

`DexScreener / chain RPCs / wallet trackers / Twitter-X / Telegram / Reddit / other sources`

`→ SHARK observations`

`→ entity + relationship understanding`

`→ risk + street-smarts + statistical reasoning`

`→ SHARK decision`

`→ Jhadina authorization/safeguard`

`→ execution adapter (later)`

Every completed decision can produce an outcome, which updates the statistical learning state for future decisions.
