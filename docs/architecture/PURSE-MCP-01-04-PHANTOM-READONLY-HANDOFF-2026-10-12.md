# PURSE-MCP.01–.04 — Phantom agent-wallet observation and containment
Date: 2026-10-12. Scope: **code-only, no funds moved, not live-certified**.

## Existing implementation (do not replace)

- Browser/user Phantom: `apps/jhadina-web/src/lib/wallet/phantom.ts`; separate Money browser integration: `apps/jhadina-web/src/lib/money/phantom-wallet.ts`.
- Owner wallet registry: `apps/jhadina-web/src/lib/wallet/registry.ts` has `tradingEnabled:false`.
- Money server wallet metadata: `apps/jhadina-web/src/app/api/money/wallet-connections/route.ts`; these are `OWNER_WALLET` records.
- SHARK public-address intelligence: `apps/jhadina-web/src/app/api/wallet/intelligence/route.ts`.
- Wallet authority boundary: `packages/money-core/src/wallet-connector-contracts.ts`.
- Purse's capital decisions are not signing permits or provider execution authority. Coffer and the governed Money executors own any future authorized financial side effect.

**Never silently import an MCP agent wallet into `OWNER_WALLET`, overwrite an existing Coffer connection, replace a provider signer or alter Coffer IDs/tables.**

## Official Phantom MCP distinction

Phantom's MCP server (`@phantom/mcp-server`) uses a **dedicated new agent wallet**, not the browser extension's personal wallet, on first sign-in. The server exposes read-only discovery tools but also `buy_token`, `transfer_tokens`, `send_solana_transaction`, `send_evm_transaction`, `sign_*`, `portfolio_rebalance`, `pay_api_access` and perp tools with financial effects. Some tools can execute without another API call when their execution flag is enabled.

Official documentation: https://docs.phantom.com/phantom-mcp-server and https://docs.phantom.com/phantom-mcp-server/tools

`@phantom/api-key-stamper` is not needed for this MCP observation implementation.

## New narrow code

`packages/money-core/src/phantom-agent-mcp-observer.ts` implements:

1. Hard-coded allowed MCP tool set: `get_connection_status`, `get_wallet_addresses`, `get_token_balances`. Current discovery calls only `get_wallet_addresses`; the pinned observer additionally calls `get_token_balances` restricted to `networks:['solana']`, `derivationIndex:0`.
2. Default denial of **every** other name, including simulation, signing, login, fee payment, swaps, derivatives and portfolio-rebalance tools. No arbitrary tool arguments are forwarded.
3. Discovery-only response for unaudited `walletId` and Solana public address. Neither balances nor a spendable account is emitted during discovery.
4. For balance observations, require an externally owner-approved exact `walletId` and Solana address pin. Reject pin changes, duplicated or invalid identities, owner/agent wallet collisions, provider errors and malformed responses.
5. Digest provider response to a SHA-256 evidence identifier. Do not propagate raw untrusted MCP response text into prompts, logs, commands or Purse financial authority.
6. Return explicit `authority:'OBSERVATION_ONLY'`, `financialAuthority:'NONE'`, `canSign:false`, `canExecute:false`, `canAuthorizeLive:false` and `spendableBalanceMinor:null`. A provider valuation is not reconciled Coffer cash.

The adapter accepts an injected `callTool` transport interface. There is deliberately **no direct SDK installation, session loading, or automatic sign-in in the web app**.

## Security requirements for owner-host commissioning

1. Run the Phantom MCP process on an **isolated owner-controlled worker**, not in the public Vercel client, not in Supabase client code, and not directly available as an unrestricted MCP server to the reasoning agent.
2. Install and pin a reviewed `@phantom/mcp-server` version on that worker, with restricted filesystem and process permissions. Never commit `~/.phantom-mcp/session.json`, wallet credentials, developer tokens, private keys or mnemonic phrases.
3. Complete Phantom device-code sign-in with the owner. Discover the wallet and record the exact **agent** wallet ID/address separately from any existing owner Phantom wallet.
4. Through a trusted owner-confirmation workflow, pin the discovered agent wallet ID/address in private worker configuration. This code does **not** provide that owner-authenticated pin store.
5. Expose only the narrow adapter's read-only operations to Jhadina. A process with access to the underlying raw MCP tool dispatcher can bypass this TypeScript guard; process-level capability isolation is mandatory.
6. Independently verify the returned identity and live chain balances using admitted RPC/provider data before using any financial numbers. Do not equate a hash with proven balance, custody, ownership or solvency.
7. If sign-in expires, the identity changes, a response is invalid, or a user-wallet collision appears, stop and require new owner confirmation. Never fall back to another wallet or auto-start a new sign-in.
8. No wallet funding, on-chain signing, transfers, swaps, leveraged trading, wallet approvals, paid quota transactions or live permits are authorized by this phase.

## Non-live acceptance checks

- `pnpm --filter @jhadina/money-core type-check`
- `pnpm --filter @jhadina/money-core exec tsx --test src/phantom-agent-mcp-observer.test.ts`
- Full Money R13B CI and independent PR review at exact head.
- Manual owner-host device login + identity pin + authenticated balance readback remains pending, as does independently verified source evidence.
- Supabase portability/recovery and the previously open Purse release PRs have their own gates. **No database migration** is necessary for this observation-only module.

## Milestone disposition

- **PURSE-MCP.01:** existing wallet/Purse/Coffer/SHARK integration paths inspected; duplication avoided.
- **PURSE-MCP.02:** read-only MCP transport contract + observation implementation committed, **not wired to a live MCP process**.
- **PURSE-MCP.03:** authentication, exact wallet pin and genuine balance readback **blocked on owner-controlled host sign-in and runtime evidence**.
- **PURSE-MCP.04:** default-deny in-code capability policy and deterministic hostile/failure tests; **process isolation and real credential security still to certify**.

Next: verify CI + review this PR, commission an isolated host, authenticate Phantom, pin identity and verify a live read-only snapshot without granting any trading execution.
