# PURSE-MCP.05–.08 — isolated observer, independent SOL verification, owner Money UI
Date: 2026-10-12. Parent PR #1231. This is a **stacked, code-only draft**. No wallet login, funding, transfer, signing, live trade or production worker commissioning has occurred.

## Why this is separate from Jhadina's personal Phantom wallet

Phantom MCP creates a dedicated agent wallet on authentication. The owner browser wallet, the dedicated agent wallet, and Coffer's separately governed DEX custody remain three independent identities. An agent observation must **never** be imported as spendable Coffer cash or an execution permit.

Official Phantom docs:
- https://docs.phantom.com/phantom-mcp-server
- https://docs.phantom.com/phantom-mcp-server/tools

## Implementation

1. `phantom-agent-observation-http.ts`: private, bearer-authenticated HTTP handler whose *only* route is `GET /v1/observation`; no generic MCP tool selection, no request parameters, POST/PUT signing or credential login. A trusted owner-host bootstrap must inject an already-authenticated `PhantomMcpReadOnlyTransport`. **This is not a process-level sandbox**; it must be isolated and only exposed over a trusted private HTTPS reverse proxy.
2. `phantom-agent-chain-verification.ts`: validates exact externally pinned agent identity and observation freshness (120s max, 30s skew), independently fetches **confirmed native SOL balance only** with `getBalance` from the separately configured Solana JSON-RPC endpoint, and attaches two source hashes. Neither hash alone proves source provenance or financial entitlement. No SPL, EVM, NFT or USD claim.
3. `/api/money/phantom-agent`: Supabase-authenticated, **owner-user-ID restricted** read-only GET. Does not expose Phantom MCP/session credentials or the worker bearer. Fails closed if worker, owner PIN, RPC, TLS, session or response validation fails. No mutating API methods are implemented.
4. `phantom-agent-wallet-card.tsx`: owner Money command center now shows a dedicated MCP card alongside personal Phantom and Coffer. Displays only independent chain-verified SOL or a blocked/not-commissioned status; manual refresh is GET-only.
5. `phantomNativeSolToResearchEvidence`: explicitly labeled, non-executing candidate for future SHARK/SHADOW ingestion. The contract has `canTrade:false` and does **not** write a research ledger or automatically enroll a trading strategy.
6. `phantom-agent-monitoring.test.ts`: local mock HTTP access, denial of generic tools/mutations, response scrubbing, RPC validation, pin collisions, replay/staleness and authority regression. Never hits real Phantom or Solana.

## Required server settings (owner-only, private)

No values should appear in GitHub, client code, support chats or frontend logs.

- `PHANTOM_AGENT_OWNER_USER_ID`: sole Supabase Auth user UUID authorized to see the snapshot.
- `PHANTOM_AGENT_PIN_WALLET_ID`: independently owner-approved Phantom MCP agent wallet ID.
- `PHANTOM_AGENT_PIN_SOLANA_ADDRESS`: independently owner-approved Solana address from the **same** agent wallet at derivation index 0.
- `PHANTOM_AGENT_OBSERVER_URL`: trusted worker HTTPS URL ending in exactly `/v1/observation`. Workers should be accessible only over a private network or mTLS/authenticated reverse proxy.
- `PHANTOM_AGENT_OBSERVER_BEARER_TOKEN`: high-entropy, separate bearer secret with >=32 chars, matching the worker's secret. Rotate on compromise.
- `SOLANA_RPC_URL`: independently provisioned HTTPS Solana RPC URL, not a Phantom MCP result.
- Worker bootstrap inputs: transport using reviewed version-pinned `@phantom/mcp-server`, exact approved ID/address pins, and a distinct allowlist of owner-wallet addresses to prevent accidental overlap.

A bare file or code module cannot provide a secure Phantom session, private HTTPS network or process isolation. Host setup is intentionally **not claimed complete**.

## Risk gates / limitations

- This code does **not** execute `phantom_login`, start a Phantom MCP stdio process, or install its npm package. Official tools beyond three read-only methods are never invoked by the in-code adapter.
- The low-privilege HTTP facade must run as a dedicated operating system identity, inaccessible to the assistant's arbitrary tool runner. Merely hiding mutation tools in a prompt is not isolation.
- Bearer authentication alone is insufficient over the open internet; require trusted TLS/private access, network egress control, file permissions for the Phantom session, host access audit and emergency session revocation.
- Live RPC verification confirms public-chain native SOL at a slot, **not** Phantom custody, SPL balances, value in USD or authorization to transact. If any source fails, return blocked rather than silently use old snapshots.
- No new Supabase table or Money/Coffer transfer path is introduced. There is no automated ingestion of SHARK/SHADOW yet; observation mapping is a data-only contract.
- Unmerged Purse PR stack (e.g. #1162 and #1192) retains its own review and live readiness gates.
- This path is **not live-certified**. Owner-host login, verified TLS, process isolation, exact-head CI, independent review, immutable external persistence, replay resistance of worker-to-web evidence and actual MCP/RPC readback remain outstanding.

## Verification

```sh
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core exec tsx --test src/phantom-agent-mcp-observer.test.ts src/phantom-agent-monitoring.test.ts
pnpm --filter @jhadina/money-core test
pnpm --filter @jhadina/jhadina-web exec tsc --noEmit -p tsconfig.money.json
```

Expected UI without owner-host configuration: separate agent card shows **BLOCKED**; the existing owner Phantom connection and Coffer card remain as they were.

## Milestone disposition

- `PURSE-MCP.05`: private read-only HTTP facade, **not** live process/host commissioned.
- `PURSE-MCP.06`: independent confirmed native-SOL RPC verifier, code/tests only; **no genuine chain evidence collected**.
- `PURSE-MCP.07`: owner-only read endpoint and separate Money dashboard card; SHARK/SHADOW **research projection only**, no pipeline ingestion or durable ledger claims.
- `PURSE-MCP.08`: deterministic fail-closed regression tests + draft PR. Full exact-head CI and independent human review required; **no financial authority certification**.

## Next commissioning order

Independent review/CI and merge PR #1231 before this stacked PR. Then owner host preparation → reviewed pinned Phantom MCP installation → device-code login by owner → exact wallet/address pin via trusted configuration → private TLS worker and process sandbox → independent RPC readback and chain history confirmation → encrypted durable evidence store → SHARK/SHADOW forward learning (no execution) → security audit and runtime certification. Treat any stale/unauthenticated session as blocked, not a reason to auto-login or refocus onto the owner's personal wallet.
