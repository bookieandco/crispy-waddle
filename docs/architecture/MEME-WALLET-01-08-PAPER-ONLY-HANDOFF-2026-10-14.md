# MEME-WALLET.01–.08 — Jhadina Sniper Paper-Only Wallet
October 14, 2026. Stacked on draft PR #1281 (watch-only owner-created wallet) → #1280 → previous Phantom draft stack.

## Authority boundary

An owner-created Solana address has been supplied privately in the ChatGPT conversation. This PR does **not** hard-code the address in source, test fixtures, env files, or public UI defaults. A 32-byte Base58 address alone does not prove signing control. It is **not** Phantom MCP's separately authenticated agent wallet, and is not Coffer's execution signer.

The code in `packages/money-core/src/meme-wallet-paper-gate.ts` never imports `RemoteCofferSignerAdapter`, `JupiterUltraDexAdapter`, wallet raw keys, Phantom MCP stdio, Telegram bot write tools, or transfer APIs. The only output is research/paper evidence with `canSign=false`, `canExecute=false`, `canMoveMoney=false`.

## Eight steps implemented as **paper-domain contracts and safety tests**

- **.01 — Wallet ID binding:** `bindOwnerCreatedMemeWallet` accepts the public wallet address as an input, checks Solana address decoding, rejects collision with owner, Coffer and MCP wallets, and produces an unverified, non-signing identity. Challenge evidence, if separately supplied, marks control verified without granting signing.
- **.02 — SHARK bridge contract:** Accepts a typed `MemeWalletCandidate` from SHARK research only, with case/strategy IDs and provenance. This is NOT an automatic SHARK worker connection.
- **.03 — Rug protection:** Refuses missing liquidity, sellability, token permissions, holder-distribution checks, rug veto, stale quotes, insufficient cost confidence, or excessive price impact. These Boolean fields require independent, fresh provider/on-chain evidence in a future runtime.
- **.04 — Limits:** Requires an owner-reviewed paper-only policy and bounds per-entry, paper day notional, exposure, simulated loss, and number of orders. Unknown settlements or a halted paper state fail closed. There are **no live wallet spending permissions**.
- **.05 — Paper simulation receipts:** Assesses SHARK proposals and creates explicit paper success/failure/unknown receipts. Their simulated fees do not equate to realized financial P&L.
- **.06 — Future DEX path:** Live execution remains out of scope; the existing Money controlled canary runtime and signer architecture are documented as the only separately governed downstream path, not wired to this wallet.
- **.07 — Signer isolation:** No signer lease, execution permit, key custody, wallet session, signing tool, or transaction broadcast is added. Both lease and permit fields are null in paper decisions.
- **.08 — Commissioning gate and regression:** `evaluateMemeWalletFutureCanary` always returns BLOCKED and names missing identity proof, host signing isolation, owner mandate, sell simulation, reconciliation and live limit certification. Regression tests enforce permanent zero live authority in this stage.

## Manual commissioning prerequisites — not yet done

1. Verify owner control of the exact dedicated address through an authenticated non-transactional challenge. Do **not** send a seed phrase or private key to any agent.
2. Implement an authenticated owner-bound server registry that distinguishes the owner-created address from Phantom MCP and Coffer. The current watch card is browser-local and the code has **not** been deployed.
3. Wire canonical SHARK sniper candidates and verified liquidity/sellability observations into a durable paper loop. A fabricated `sellabilityVerified=true` flag from a text or model signal must never authorize a trade.
4. Test paper entries/exits, costs, latency, unknown fills, slippage, drawdown and defensive halts against actual timestamped evidence for at least an agreed evaluation window.
5. Independent audit of the owner-created wallet's custody model. The Phantom MCP observer must **not** be upgraded into a generic signing dispatcher.
6. Owner must explicitly adopt precise bounded real-risk limits in an independently enforced custody/signing service, and prove permit, signed transaction, end-to-end reconciliation and emergency kill switch with a tightly controlled canary.
7. No actual account funded, no signer provisioned, no live DEX/Telegram trading activated and no owner money spent here.

## Verification
```sh
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core verify:meme-wallet
pnpm --filter @jhadina/money-core test
```
Software test pass ≠ live commissioning. Parent PRs are draft/unmerged. Financial authority remains NONE.
