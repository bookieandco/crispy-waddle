# DEX runtime canary operations — funding, entry/exit, and post-canary lock

Status: repository implementation for operational readiness.

## What this closes

The Money command center can now tell the owner exactly why a real DEX canary is blocked without exposing secrets. It checks:

1. isolated Solana Coffer wallet;
2. active secret-free signer lease;
3. non-zero MEME strategy budget;
4. Jupiter DEX connector admitted only as `CONTROLLED_CANARY`;
5. server-side Jupiter credential presence;
6. HTTPS Coffer signer endpoint presence;
7. signer-service authorization presence;
8. HTTPS Solana RPC presence;
9. canonical settlement mint;
10. verified settlement-asset funding;
11. verified SOL fee reserve.

The funding verifier reads the isolated Coffer wallet directly from confirmed Solana RPC state. If both minimum balances pass, it writes durable funding evidence. It never transfers funds and never reads Phantom seed/private-key material.

## Owner-wallet versus Coffer-wallet boundary

Phantom remains the owner wallet. Connecting Phantom does not grant SHARK or Money unattended signing.

The live meme canary executes only from the separately commissioned `COFFER_EXECUTION_WALLET`.

Funding the Coffer is an owner-controlled transfer. The verifier only proves the funds arrived.

## Required server-only production configuration

- `JUPITER_API_KEY`
- `MONEY_DEX_COFFER_SIGNER_URL`
- `MONEY_DEX_COFFER_SIGNER_AUTH`
- `SOLANA_RPC_URL`
- `MONEY_DEX_SETTLEMENT_MINT`
- `MONEY_DEX_CANARY_MIN_SETTLEMENT_ATOMIC`
- `MONEY_DEX_CANARY_MIN_SOL_LAMPORTS`

None may use a `NEXT_PUBLIC_` prefix.

## Real entry -> exit sequence

The actual canary is permitted only when the readiness report is `READY_FOR_CONTROLLED_CANARY`.

The existing DEX-COMMISSION.FINAL runtime then performs:

```
SHARK candidate
 -> EDGE-007 PASS
 -> Money authority + risk
 -> single-use execution permit
 -> signed simulation
 -> one bounded entry
 -> on-chain reconciliation
 -> restart/recovery proof
 -> one bounded exit
 -> on-chain reconciliation
 -> target-token balance = 0
 -> kill-switch drill
 -> runtime verification receipt
 -> Stage-4 certificate
```

A real canary is not considered complete from a quote, simulation, provider acknowledgement, or entry alone. Both on-chain signatures and both reconciliations are required.

## Unrestricted meme trading remains locked

Passing the first real canary does not promote the DEX connector to `LIVE` and does not set `unrestrictedLiveAuthorized=true`.

That is intentional. A single successful round trip proves the execution boundary; it does not prove that the strategy has earned unbounded capital authority.

The next production mode, if separately implemented and owner-authorized, should remain budgeted, kill-switchable, and permit-bound. No code path in DEX-COMMISSION.FINAL automatically converts a controlled canary into unrestricted trading.

## UI

Money -> Command Center -> DEX controlled canary -> Runtime readiness.

Use **Verify canary funding** after the Coffer has received the tiny settlement balance and SOL fee reserve. The action is read/verification-only and records evidence only after confirmed RPC balances meet the configured minima.
