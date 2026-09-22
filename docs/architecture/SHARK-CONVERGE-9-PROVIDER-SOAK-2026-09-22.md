# SHARK-CONVERGE.9 — Read-only provider soak

Status: **PENDING LIVE INVOCATION**

Date: 2026-09-22

## Scope

This gate certifies read-only provider availability for SHARK intelligence. It does not admit trading, wallet signing, protected capital, or market mutation.

Required live checks:

- DexScreener token-pair API;
- Helius JSON-RPC health;
- CoinGecko Pro on-chain OHLCV;
- configured Solana RPC;
- Pump program visibility;
- PumpSwap program visibility;
- Raydium AMM v4 program visibility;
- Meteora DLMM program visibility.

## Production observations before this change

Production database commissioning is already complete under SHARK-CONVERGE.8.

A live inspection on 2026-09-22 found zero durable production rows in the SHARK launch, actor, market-event, wallet-intelligence, wallet-cluster-calibration, Meteora cash-flow, Meteora position-state, and historical-backfill tables.

Production Vercel logs for the current main deployment showed no SHARK route activity during the inspected window for:

- /api/webhooks/helius/launches
- /api/wallet/intelligence
- /api/internal/shark/*

No SHARK runtime error cluster was present in that window. The absence of rows is therefore currently best explained by lack of runtime invocation/provider flow, not by a demonstrated persistence failure.

## Soak implementation

PR #582 adds:

- `packages/shark-intelligence-core/src/meme-trader/provider-soak.ts`
- `packages/shark-intelligence-core/src/meme-trader/__tests__/provider-soak.test.ts`
- `apps/jhadina-web/src/app/api/internal/shark/provider-soak/route.ts`

The route is protected by `CRON_SECRET`.

The receipt contract guarantees:

- `writesPerformed = 0`
- `financialAuthority = NONE`
- `walletSigningAuthority = NONE`
- every check has `authority = READ_ONLY`
- provider URLs and credentials are never returned
- missing configuration fails closed as `UNCONFIGURED`

## Program identities

The soak checks executable Solana program accounts for:

- Pump: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
- PumpSwap: `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`
- Raydium AMM v4: `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`
- Meteora DLMM: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`

Wrapped SOL is used only as a public read-only reference mint for provider health.

## CI state

The provider-soak code is type-checked by the repo-wide launch gate and is covered by the SHARK package test suite.

The dedicated SHARK workflow on main currently has a malformed PL/pgSQL dollar-quote guard. PR #581 repairs that workflow. Until #581 lands, missing focused SHARK workflow runs must not be interpreted as a source failure.

## Live acceptance rule

CONVERGE.9 becomes PASS only when the deployed production route is invoked with authorized internal credentials and returns:

- every required provider/program check = `READY`
- `passed = true`
- no secret material in the response
- `writesPerformed = 0`

A failed, degraded, or unconfigured provider leaves this gate open.

## Explicit non-goals

This gate does not:

- configure or verify a DEX execution provider;
- verify a dedicated trading wallet;
- place a live canary trade;
- authorize copy trading or MEV;
- write Money production-commissioning receipts automatically.

Those remain separate governed Money production-admission gates.
