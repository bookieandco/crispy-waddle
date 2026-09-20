# MONEY-FINAL repository + handoff audit — 2026-09-20

## Scope
Audited current `main` Money Core, Jhadina web Money composition, Supabase bank ownership, SHARK, sports ingress, stock/FX/live-canary work, repository provenance records, and the historical Money handoff requirements.

## Preserved invariants
- Action Core owns authorization. Money execution permits are downstream proofs, never a second policy authority.
- Intelligence/prediction is evidence, not execution. Sports ingress remains `INTELLIGENCE_ONLY` with betting/financial authority `NONE`.
- Non-meme stocks/forex remain manual-canary-only; no autonomous stock/forex execution was enabled.
- SHARK/meme intelligence remains isolated from the protected Money read/banking spine and does not gain protected-fund authority.
- Read != write != approval != execution. Unknown provider execution blocks further attempts until reconciliation.
- Protected reserves/capital allocation, exact-money/accounting, idempotency, reconciliation, kill switch and durable provider-event processing remain canonical Money concerns.

## Repository reconciliation
### Confirmed current implementation
- `@jhadina/money-core` now has a real package surface, exact-money/accounting primitives, durable idempotency/event processing, Action-Core authority binding, execution permits/attempts/recovery, Plaid read-only provider, stock/FX reality/intelligence, sports research ingress, live-canary controls, Alpaca manual-canary work and MONEY-055/MONEY-060 certification contracts.
- SHARK now has its own package manifest/tests and materially implements DexScreener, Pump/PumpSwap, Raydium/Meteora liquidity, wallet/entity intelligence and adversarial risk evidence. Historical “package absent” findings are superseded.
- Sports → Money is correctly narrow: prediction envelopes may become research evidence only and cannot pre-populate Money risk/authority.
- The historical duplicate Money `ActionProposal`/`PolicyDecision`/`AuditReceipt` authority concern is superseded by `action-core-authority-bridge.ts`; no duplicate Money authority type was found in current source.
- Handoff references OpenBB, StockSharp, Freqtrade and prediction-market repositories remain research references rather than silently becoming runtime dependencies. Current source does not claim code derivation from them.

### Audit repairs in this branch
1. Declared `@jhadina/action-core` as an actual `@jhadina/money-core` workspace dependency and reconciled the lockfile. Money imported Action Core without declaring it.
2. Closed a bank-credential exposure/design defect introduced during read-spine commissioning. The ownership table mixed owner-readable authorization metadata with encrypted Plaid access tokens. Credentials now live in `jhadina_money_bank_credentials`, a service-role-only RLS table; browser roles have no table privileges.
3. Bank Link exchange/disconnect and per-Item adapter resolution now use the existing server-only Supabase service-role client after request identity verification. User identity is explicitly bound into every connection write/disconnect query.
4. The browser/session role may resolve only active owned account IDs. It cannot read Item credentials or mutate ownership rows directly.
5. Removed stale comments claiming the repository still lacks a per-user Plaid ownership map.
6. Applied the credential-hardening migrations to the live Jhadina Supabase project and verified the legacy browser-callable mutation RPCs are no longer executable by `authenticated`.
7. Closed an intelligence-authority gap: `assertIntelligenceOnly()` previously rejected only payment/transfer capabilities even though Money's canonical mutation boundary also includes account changes, orders, trades, borrowing and allocation. A single shared mutation classifier now governs both intelligence rejection and ActionRequest eligibility, with regression coverage.

## Reference/handoff disposition
- Plaid: implemented read-only banking/provider boundary plus sandbox Link commissioning path.
- Coinbase: historical/read-only Capital Lab reference remains non-executing.
- OpenBB / StockSharp / Freqtrade: handoff research references; no current runtime dependency or unverified code reuse found.
- Polymarket / Kalshi: prediction-market research references; no autonomous market execution path found in Money Core.
- SHARK references: DexScreener/CoinGecko/Helius provider paths are repository-traceable; Pump/Meteora/wallet-cluster handoff references remain governed by the reference-provenance ledger and do not imply source-code derivation.
- Sports: research ingress only; Money independently evaluates risk, capital and authority.

## MONEY-FINAL acceptance status
Software architecture is accepted subject to CI on this repair branch. Live banking commissioning is still sandbox/read-only. MONEY-FINAL must not claim live-bank or autonomous-trading production authority.

Final closure requires all of:
1. this repair PR merged;
2. Money R13B + Money package tests/type-check + Spatial Conformance green;
3. deployed server has `SUPABASE_SERVICE_ROLE_KEY`, `JHADINA_MONEY_CREDENTIAL_KEY` and `JHADINA_SECRET_PLAID_DEFAULT` server-only;
4. one authenticated Plaid sandbox drill proves Link -> private credential persistence -> owned account read -> governed transaction read -> durable audit -> disconnect -> post-disconnect denial;
5. closure receipt records the deployed commit and drill evidence.

No requirement above authorizes autonomous stock/forex trading, protected-fund access by SHARK, or automatic sports betting.
