# Jhadina Purse — Owner-created Solana wallet registration (read-only)

October 14, 2026. Stacked on PURSE-MCP.29–.32 and preceding draft PRs.

## What changed
The owner reported creating a separate Phantom/Solana wallet for Jhadina. It is a **user-created, owner-controlled public address**, NOT a verified Phantom MCP server-managed agent wallet and NOT the Coffer execution signer.

The Money Command Center now has a dedicated **Jhadina Purse / Dedicated Solana wallet** card that accepts a public Solana address through an explicit owner action. The address is validated as canonical 32-byte Solana Base58, assigned local purpose `JHADINA_DEDICATED`, and stored in the browser's local storage for that device. The card can open the public account in Solana Explorer or remove the local record.

This PR intentionally DOES NOT embed the owner's supplied public address in Git, config, source, test fixtures, CI logs, URLs or tracking; the owner will paste the public address in the app once it is reviewed and deployed.

The watch-only registry creates immutable false permissions:
- `status: LOCAL_WATCH_ONLY_UNVERIFIED`
- `custody: OWNER_CREATED_UNVERIFIED`
- `observationEnabled: false` (there is no actual live balance feed)
- `verifiedControl: false`
- `phantomMcpConnected: false`
- `canSign: false`, `canExecute: false`, `canMoveMoney: false`

The UI rejects direct collision with saved Money workspace owner or Coffer wallet addresses. A client-local record is **not** an authenticated global owner registry, backend portfolio account, money-transfer destination, or balance proof. The existing browser-connected Phantom wallet and Phantom MCP draft read-only observation card remain separate surfaces. This avoids silently merging a newly created owner wallet into an uncommissioned Phantom MCP dedicated agent wallet.

## Expected owner workflow after review + deployment
1. Open Jhadina Money Command Center on the intended iPhone/browser.
2. Find **Dedicated Solana wallet → Public Solana wallet address**, and paste **only the public Solana address**.
3. Save on this device. Observe the **WATCH ONLY** status. This does not authenticate, attach an MCP server, verify control, read balances, or link the address across devices.
4. Until a separately reviewed, owner-authenticated backend registration endpoint and wallet-control proof are built, the record remains local only.
5. Never enter recovery phrase, seed/private keys, authentication tokens, or provide unattended signer access.
6. Do not fund based on a watch-only UI or a synthetic observation. Owner remains responsible for custody.

## Delivery blockers
- Parent PR chain not merged. Web deployment not made.
- No current Supabase owner-bound private wallet registry write. Do not store the owner address under `money_wallet_connections` as an authenticated Phantom connection based solely on an unverified public address.
- No proof the user controls the public address. No actual Phantom provider connection, signing authority, or Phantom MCP wallet binding.
- No live Solana balance query or authorized autonomous access, and no configured cross-device sync.
- Wallet funds and trading permissions remain untouched.

## Checks
```sh
pnpm --filter @jhadina/jhadina-web exec vitest run src/lib/wallet/jhadina-watch-wallet.test.ts
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/money-core type-check
```

If/when a future private backend registry is developed, it must be bound to `auth.uid()`, enforce ownership and RLS, and require explicit consent before changing any wallet role or enabling on-chain observation. A public address alone must never give authority to trade or transfer.
