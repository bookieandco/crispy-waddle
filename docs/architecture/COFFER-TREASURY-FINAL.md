# COFFER-TREASURY.FINAL — multi-asset fiat + crypto treasury foundation

## Outcome

Coffer is a treasury, not only a Solana execution wallet.

The canonical model now supports:

- fiat balances;
- stablecoin balances;
- native/token crypto balances;
- bank, broker-cash, Coffer-cash, exchange and crypto-wallet custody;
- deposits;
- withdrawals;
- same-asset transfers;
- fiat-to-fiat FX;
- fiat-to-crypto / crypto-to-fiat conversion;
- crypto-to-crypto conversion;
- normalized reporting value without discarding native asset quantities.

## Important semantic split

A **movement** changes custody while preserving the asset.

Examples:

- bank USD -> Coffer USD;
- Coffer USD -> verified owner bank;
- Coffer USDC wallet A -> Coffer USDC wallet B.

A **conversion** changes the asset.

Examples:

- USD -> EUR;
- USD -> USDC;
- USDC -> USD;
- USDC -> SOL;
- SOL -> USDC.

Cross-asset exchange is never encoded as a normal transfer.

## Existing movement spine retained

MONEY-FUND.2 remains authoritative for governed deposits, withdrawals and fiat/provider transfers:

verified endpoints -> proposal -> owner/mandate authority -> execution permit -> provider quote/instruction -> single-submit attempt -> provider evidence -> reconciliation.

Crypto wallet movements retain the existing Coffer wallet/signer boundary.

This extension does not create a second movement authority plane.

## Multi-asset accounting

`CofferAssetBalanceEvidence` keeps both:

1. exact native/atomic asset quantity; and
2. evidence-backed reporting value in the Coffer reporting currency.

That allows one treasury view across USD, EUR, USDC, SOL, ETH and future admitted assets without pretending the assets are interchangeable.

Reserved reporting value is carried separately so trading cannot consume capital reserved for gas, withdrawals, survival floors or other obligations.

## Conversion governance

A conversion quote binds:

- provider;
- source and destination endpoints;
- source and destination assets;
- source amount;
- quoted and minimum destination amount;
- rational exchange-rate evidence;
- provider fee;
- network fee;
- spread;
- quote and expiry times;
- evidence IDs.

The quote has no execution authority.

A conversion proposal is fingerprint-bound to the exact quote. Promotion requires separate authority and an execution permit. Even the resulting provider instruction remains non-executing until a future commissioned conversion executor performs final policy revalidation and single-submit execution.

## Durable evidence

The Supabase migration adds append-only, service-role-only tables:

- `money_coffer_asset_balance_snapshots`;
- `money_coffer_conversion_events`.

Both FORCE RLS, deny anon/authenticated access, expose only SELECT/INSERT to service role, and carry DB-level no-authority constraints.

No raw bank credentials, seed phrases, wallet private keys, signer tokens or provider execution credentials belong in these tables.

## What this does not claim

This foundation does not claim a real bank, FX venue, exchange, on-ramp or off-ramp is commissioned.

External commissioning remains required for:

- live ACH/bank deposits and withdrawals;
- live fiat FX;
- live fiat <-> crypto on/off-ramping;
- live exchange conversion;
- live chain transfer/signing.

Each provider must be separately admitted, credentialed through an external secret boundary, canary-tested and reconciled before any production money movement.

## Next runtime sequence

1. COFFER-TREASURY provider registry / route selection.
2. Fiat rail commissioning.
3. Crypto transfer rail commissioning.
4. Conversion provider commissioning.
5. On-ramp/off-ramp route composition.
6. Treasury shadow certification.
7. Tiny deposit/withdraw/conversion canaries.
8. Multi-asset accountant/reconciliation certification.

`unrestrictedLiveAuthorized=false` remains the production invariant.
