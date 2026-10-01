# COFFER-SHADOW.FINAL — governed route intelligence with zero execution authority

## Scope

This closure finishes the software path from Coffer commissioning through live-market shadow routing while preserving the production boundary: shadow code cannot sign a transaction and cannot broadcast a transaction.

## Completed build sequence

1. **COFFER-COMMISSION.1 — Production wallet + signer boundary**
   - isolated `COFFER_EXECUTION_WALLET` contract;
   - secret-free signer leases with expiry, per-transaction/24h caps, destination and asset allowlists;
   - remote signer uses HTTPS and returns only signed output/evidence;
   - `IsolatedCofferSignerService` now implements the signer-side cryptographic boundary with Node Ed25519 primitives: it accepts only one-signer unsigned Solana transactions, verifies the transaction signer equals the configured Coffer public key, requires an external lease-verification receipt, signs only the serialized message, zeroes its decoded seed buffer after use, and never returns seed/private-key/token material;
   - runtime readiness refuses owner wallets, expired leases, missing signer configuration, or leaked secret material.

2. **COFFER-COMMISSION.2 — Funding rail**
   - governed owner-to-Coffer and Coffer-to-owner movement substrate;
   - provider commissioning receipts, accounting reconciliation and profit-sweep controls already exist;
   - live DEX readiness additionally requires verified canary funding and SOL fee-reserve evidence.

3. **SHARK-PREEXEC.FINAL**
   - each executable DEX intent is immutably bound to SHARK assessment, thesis, EDGE-001..006 bundle, EDGE-007 integrity receipt, Money risk decision and exact intent fingerprint;
   - none of those research/risk receipts can authorize execution by themselves.

4. **DEX-ROUTER.FINAL**
   - `GovernedDexRouteRouter` normalizes Jupiter Swap V2, Raydium-direct and Meteora-direct quote providers;
   - provider failure falls through to the next commissioned route;
   - only quotes that pass Money's route gate are eligible;
   - route decisions explicitly expose `canSign=false` and `canBroadcast=false`.
   - `GovernedDexTransactionPreparer` converts only the selected, gate-passing route into an unsigned transaction and still exposes `canSign=false` / `canBroadcast=false`;
   - Jupiter uses Swap API V2 order preparation; Raydium re-quotes through the Trade API and requires a single V0 transaction plus explicit token-account and priority-fee resolution; Meteora binds current pool-state/quote/transaction construction through the official DLMM SDK boundary;
   - production signer/broadcast remains in Money, never in SHARK, and direct-venue live submission remains uncommissioned until a separately governed runtime canary.

5. **MONEY-DEX-GATE.FINAL**
   - hard stale-quote/expiry rejection;
   - slippage ceiling;
   - price-impact ceiling and required evidence option;
   - fee ceiling;
   - liquidity floor and required evidence option;
   - provider allowlist;
   - consecutive-realized-loss halt and explicit loss-halt input.

6. **TRADE-MEMORY.FINAL**
   - canonical durable trade-event sequence and `jhadina_trade_memory_records` projection remain the shared source of truth.

7. **COFFER-ACCOUNTING.FINAL**
   - Coffer accounting, floors, deployable capital, movement reconciliation and profit sweeps remain authoritative for capital state.

8. **COFFER-RECOVERY.FINAL**
   - execution attempts are persisted before broadcast;
   - idempotency and on-chain reconciliation prevent blind duplicate submission;
   - restart recovery proves the stored signature against chain truth before any retry decision.

9. **COFFER-SHADOW.FINAL**
   - `runCofferShadow` obtains governed route quotes and emits DEX `LIVE_SHADOW` evidence;
   - `PostgresCofferShadowStore` persists the route/stage/certification evidence with bigint-safe serialization and rehydrates it without introducing any financial authority;
   - the stage requires real/recorded market evidence and passing EDGE receipts;
   - shadow runs contain exactly zero signed transactions and zero broadcasts;
   - database constraints independently enforce `signed_transaction_count = 0`, `broadcast_count = 0`, and `financial_authority = 'NONE'`;
   - `certifyCofferShadowFinal` never authorizes unrestricted live trading.

## Current production boundary

Software completion is not the same as external commissioning. A real production wallet/signer may only be marked commissioned when the live database contains a genuine Coffer execution-wallet connection and an active signer lease tied to external signer infrastructure. Funding may only be marked commissioned from observed/reconciled funding evidence. No synthetic rows are permitted to satisfy those gates.

The controlled live canary remains downstream of this shadow closure and still requires the separately verified entry -> exit on-chain round trip. `unrestrictedLiveAuthorized` remains false.
