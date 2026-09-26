# MONEY — Parlay Chain Reference Audit (2026-09-26)

## Source

- Repository: `parlaychain/parlay`
- Pinned revision: `af20508a4adc4eab2b5661fe2222b7aebd0a1e01`
- Last upstream commit observed at audit time: 2018-06-09
- Root license at the pinned revision: MIT
- Upstream default branch: `master`

## Disposition

**EVALUATED / REFERENCE ONLY.**

Parlay Chain is not a modern prediction-market provider adapter and must not be wired into Money Core as a Kalshi, Polymarket, sportsbook, exchange, oracle or settlement source.

The upstream README describes Parlay Chain as a blockchain ecosystem with “predictor gameplay,” but the repository audit found no code-search matches for `predict`, `event`, `oracle` or `bet`. The visible source tree is instead dominated by Bitcoin-derived chain, wallet, RPC, transaction, node/PrimeNode, networking and desktop-wallet machinery.

That mismatch matters: product branding around prediction gameplay is not sufficient evidence of event identity, odds formation, order-book semantics, resolution authority, dispute rules, settlement truth or executable wagering interfaces.

## What is useful

Use this repository only as a historical architecture comparison for:

- wallet lifecycle and encrypted key-store boundaries;
- JSON-RPC / daemon separation;
- node and PrimeNode operational lifecycle;
- transaction and mempool plumbing;
- chain/network parameterization;
- old desktop-wallet composition patterns;
- the security lesson that transport/wallet infrastructure is distinct from event truth and financial authority.

These are comparison concepts only. No source-code derivation is required for Money Core.

## What is explicitly excluded

Do **not** source any of the following from Parlay Chain:

- market or event identity;
- sportsbook lines or prices;
- implied probabilities;
- prediction-market quotes or liquidity;
- event/oracle truth;
- resolution authority;
- settlement decisions;
- dispute/void treatment;
- bankroll sizing;
- autonomous entry/exit logic;
- wallet signing or custody for Money execution;
- live trading/provider admission.

The Money prediction-market reality layer remains canonical for market/outcome identity, point-in-time quotes, resolution rules, evidence lineage and complete-set consistency. Venue adapters must populate those contracts independently.

## Relationship to SHARK

SHARK may consume Money-approved cross-asset or prediction intelligence as evidence, but Parlay Chain provides no memecoin alpha, wallet-cluster truth, token-risk truth or trading authority. It therefore does not enter SHARK execution or learning paths.

## Relationship to automated Money execution

This audit grants **zero** execution authority.

Any future prediction-market automation still requires:

1. admitted provider/venue identity;
2. current provider contract and credentials;
3. canonical instrument/outcome resolution;
4. current market reality;
5. independent evidence and calibration;
6. capital and protected-reserve checks;
7. risk/policy evaluation;
8. explicit mandate/authority;
9. Action Core execution permit;
10. kill switch;
11. reconciliation, settlement and accounting.

Parlay Chain cannot satisfy any of those gates merely by being a blockchain/wallet codebase.

## Provenance decision

The reference is pinned in `@jhadina/reference-provenance` as an externally verified, MIT-licensed architecture/security reference with no runtime, factual, policy or execution authority.

This preserves the useful historical patterns while preventing the shared word “parlay” from creating a false semantic link to the modern parlay-analysis, sportsbook, Kalshi or prediction-market tooling already being evaluated for Money Core.
