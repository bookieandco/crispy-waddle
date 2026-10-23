# SHARK-GOODCRYPTO.01–.05 — source-only paper adapter

**Date:** 2026-10-23. **Scope:** offline, no deployments, no funding, no wallet or signing authority.

## Source fidelity

GoodCryptoX publicly describes a Solana Gems/Sniper screener and automated trading with take-profit / stop-loss; paper/test operation is described. Its own docs say TradingView webhook commands are **action-specific triggers**, not a general payload API, and normally only accept TradingView server calls. No sanctioned server-to-server GoodCryptoX market-data/API/trigger integration is evidenced here. Never send SHARK-generated requests to webhook URLs, create orders, or attach Phantom session keys. A pasted social-media video/transcript is anecdotal, not market evidence.

References:
- https://goodcrypto.app/solana-sniper-bot/
- https://goodcrypto.app/gem-sniper-bot-trading-mode-is-live/
- https://docs.goodcrypto.app/dex-trading-spot/webhooks
- https://docs.goodcrypto.app/wallets/built-in-wallet/smart-contract-wallets/session-keys

## Targets delivered

- **.01 Source/chronology.** `normalize` accepts only caller-supplied explicitly marked public Solana observations or user-supplied **unverified** data, known fields, recognized risk indicators, a source ID, and 30s-bounded capture chronology. It cannot attest external market truth, consent, or provider authenticity.
- **.02 Screen.** `screen` implements paper-selection thresholds and explicit blocked/missing sell-route, distribution, liquidity, volume, and exploit-pattern review gates. No green 'safe' label is issued.
- **.03 Cost/latency.** `quote_cost` caps quote age to 5s, measures claimed caller-provided end-to-end round-trip latency against a 2,000ms research budget, and bounds slippage/fees/MEV exposure and simulated depth. This is **not measured trading latency** or MEV immunity.
- **.04 Paper candidate.** `paper_entry` enforces a $25 maximum paper position, minimum simulated exit depth, deterministic receipt, no real fills. A proposal cannot sign, submit, execute, or approve trades.
- **.05 Exit/Shadow.** `paper_mark` compares +40% take-profit, -15% stop, 20% trailing stop once up 30%; uses an independently supplied, fresh **hypothetical** exit quote. No fresh quote => `UNSCORED`, not a fabricated profit. `shadow_envelope` is a read-only research envelope that explicitly cannot enter Purse without independent Money validation and TRADE-stage MIMS; it is **not** a canonical OpportunityCandidateV2 and no persistence occurs.

## Reproducible acceptance

```sh
cd ops/meme
python -m unittest -v test_shark_goodcrypto_paper.py
```

10 focused stdlib tests: deterministic provenance/receipts, no private-source ingestion, stale time rejection, risk veto, user-input quarantine, quote and MEV-cost budgets, capped paper size/depth, prospective simulated stop/trailing/TP, missing-quote `UNSCORED`, and inert Shadow/Purse handoff.

## Integration blockers / next smallest steps

1. Independent documented and owner-authorized feed/export interface for GoodCryptoX (or choose existing public SHARK feeds); avoid screenshots or unauthenticated scraping as a provider API.
2. Independently validate token security/sellability (mint/freeze/extensions/LP and pool/route depth), fee quotes, actual network latency, and source chronology. Current fields are **caller assertions**, not verification.
3. Require reproducible prospective paper execution with quote continuity, no look-ahead, dynamic route cost & simulated fills before any performance claims.
4. Do not connect this research envelope to the canonical Money/Purse ingestion or live executor without separate runtime integration and explicit review.
5. For real trading, require separately commissioned Phantom wallet authority, independent Money and Action Core risk controls, owner-approved budgets, emergency controls, and verified execution receipts. **None are authorized in this PR.**

**Result:** Research code tested locally; not deployed, no connected GoodCryptoX account or API, no wallet, and no real trades. Changes proposed for review only; CI on exact GitHub head remains independently verifiable.
