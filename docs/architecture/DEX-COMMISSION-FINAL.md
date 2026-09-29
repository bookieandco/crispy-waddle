# DEX-COMMISSION.FINAL — production swap runtime and controlled-canary closure

## Outcome

This phase converts the previously merged DEX four-stage certificate into an executable, fail-closed Solana runtime without giving SHARK signing authority.

Canonical flow:

```
SHARK assessment + thesis + EDGE-001..006 + EDGE-007
  -> Money risk decision + immutable approval-bound intent + Action Core authority
  -> single-use Money execution permit
  -> CONTROLLED_CANARY DEX connector
  -> isolated Coffer signer lease
  -> Jupiter managed order
  -> Solana unsigned pre-sign simulation
  -> bounded canary-capital reservation
  -> isolated signer returns signed transaction + deterministic signature
  -> Solana signed verification simulation
  -> persist signature/hash BEFORE provider broadcast
  -> Jupiter execute exactly once
  -> Solana getTransaction truth
  -> token delta + fee reconciliation
  -> restart recovery / duplicate block
  -> bounded exit back to settlement asset
  -> flat target-token balance
  -> kill-switch drill
  -> Stage-4 runtime verification receipt
  -> DEX-COMMISSION.FINAL certificate
```

A successful final certificate still sets `unrestrictedLiveAuthorized=false`.

## Reference audit — MeremArt/Solana-Swap

Reference: `https://github.com/MeremArt/Solana-Swap` (MIT).

Useful concept retained:

- obtain a Jupiter-produced Solana swap transaction;
- sign a versioned transaction with the intended wallet;
- submit and confirm against Solana.

Patterns deliberately not adopted:

- legacy `quote-api.jup.ag/v6` endpoints;
- browser owner-wallet signing for unattended execution;
- Pyth-derived "optimal amount" replacing the actual user input amount;
- `skipPreflight: true`;
- console-only transaction truth;
- retry without durable signature reconciliation;
- lack of capital/signer/permit/idempotency boundaries.

Current Jupiter integration uses `https://api.jup.ag/ultra/v1/order` and `/ultra/v1/execute`. API credentials are resolved at call time and never stored in Money tables.

## DEX-COMMISSION.1 — Jupiter adapter

`JupiterUltraDexAdapter`:

- HTTPS only;
- exact-in atomic amount bound to the Money intent;
- taker bound to the isolated Coffer wallet;
- rejects provider amount mismatch;
- treats quote/order responses as evidence only;
- sends a signed transaction only after Money permit/risk gates;
- never has wallet signing authority.

## DEX-COMMISSION.2 — isolated signer

`RemoteCofferSignerAdapter` calls a separately deployed HTTPS signer service.

Money sends:

- wallet connection ID;
- signer lease ID;
- unsigned transaction bytes;
- idempotency key.

Money never sends or stores:

- private key;
- mnemonic;
- seed phrase;
- raw signer token.

The signer response must attest `containsPrivateKey=false` and `containsRawToken=false`, bind the expected signer address, and return the deterministic primary Solana signature before broadcast.

## DEX-COMMISSION.3 — Solana truth

`SolanaRpcHttpObserver` performs:

- signed `simulateTransaction` with signature verification;
- confirmed `getTransaction`;
- wallet/mint token-delta extraction;
- fee observation;
- post-swap token balance observation.

The RPC endpoint is resolved at runtime so an embedded Helius/API credential never enters durable Money state.

## DEX-COMMISSION.4 — controlled canary executor

`submitControlledDexCanaryLeg` requires:

- an immutable Money execution intent bound to a SHARK assessment, thesis, passing EDGE-001–006 bundle, passing EDGE-007 receipt, Money risk decision, and exact transaction fingerprint;
- DEX connector admission exactly `CONTROLLED_CANARY`;
- provider exactly `jupiter-ultra`;
- opaque provider credential reference;
- `COFFER_EXECUTION_WALLET`;
- active secret-free signer lease;
- settlement and target mint allowlisting;
- signer per-transaction and 24-hour caps;
- Money execution permit;
- live-canary reservation;
- successful unsigned simulation before signing;
- bounded canary reservation before signing;
- successful signed verification simulation before broadcast.

The signature and signed-transaction hash are durably recorded before broadcast. The executor publishes only mechanical `TX_SIMULATED`, `TX_SIGNED`, `TX_SENT`, and `FILLED` telemetry; it has no strategy-generation authority.

Any ambiguous provider result becomes `UNKNOWN`; the runtime does not blindly submit a second transaction.

`reconcileDexCanaryLeg` uses confirmed chain truth to require:

- exact intended input debit;
- output at or above the Money minimum;
- simulated fee equals realized network fee;
- confirmed successful transaction.

## Restart recovery

`proveDexRestartRecovery` reloads a durable execution attempt in a distinct runtime identity and reconciles its pre-recorded Solana signature against the chain.

This is the anti-double-execution proof for the canary.

## Stage-4 round trip

The final canary requires:

1. settlement asset -> target token entry;
2. reconciliation;
3. restart/recovery proof;
4. target token -> settlement asset exit;
5. reconciliation;
6. target token post-exit balance exactly zero;
7. capital-boundary proof;
8. kill-switch activation and blocked post-halt reservation;
9. modeled/simulated versus realized fee tie-out;
10. provider receipt and on-chain signature for both legs.

## Durable tables

Migration 021 adds:

- `money_dex_execution_attempts`;
- `money_dex_stage4_evidence`;
- `money_dex_runtime_verifications`.

They store hashes, signatures, provider IDs, state and evidence only. They intentionally exclude raw signed transactions and all signer/provider secrets.

## Final certification

`certifyDexCommissionFinal` returns `CONTROLLED_CANARY_CERTIFIED` only when the operational four-stage report passes with a commissioned-runtime verification receipt.

Without genuine external runtime evidence it returns:

`SOFTWARE_READY_RUNTIME_CANARY_REQUIRED`

That blocked result is correct repository truth until the actual Coffer signer/provider/RPC are provisioned and funded for the tiny canary.
