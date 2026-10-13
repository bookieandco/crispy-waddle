# PURSE-MCP.09–.12 — owner-host-only Phantom MCP, forward audit, research handoff
Date: 2026-10-12. Stacked on PR #1232, which is stacked on #1231. All changes are **code-only** until independently commissioned and reviewed.

## Progress and exact boundary

- PURSE-MCP.09: `phantom-agent-restricted-stdio.ts` negotiates a deliberately pinned **legacy MCP 2025-06-18** stdio handshake and allows only `get_connection_status`, `get_wallet_addresses`, and `get_token_balances`. It refuses all other tool names and unexpected arguments, never calls login, and rejects protocol mismatch and malformed provider responses. It requires a trusted owner-host subprocess launcher.
- PURSE-MCP.10: `phantom-agent-owner-worker.ts` provides an owner-attested, **loopback-only** launcher for a separately reviewed absolute-path Phantom MCP binary, pinned account/address, local bearer-gated observation service, and distinct confirmed Solana RPC verification. It won't start without explicit operator gates. It is **not** a live owner login or a process isolation system.
- PURSE-MCP.11: `phantom-agent-study-ledger.ts` persists confirmed native SOL observations as a local HMAC-SHA256 hash chain with exclusive writer lock, fsync and ordered forward evidence. `readPhantomAgentStudyForShadow` projects only research cases: no P&L, order, transfer or market prediction. The HTTP service performs the independent RPC verification and study append **before** replying success when configured by this host launcher.
- PURSE-MCP.12: `phantom-agent-host-study.test.ts` covers protocol negotiation, mutation refusal, wrong arguments, protocol mismatch, forged audit history, wrong key, replay, stale evidence, wallet-ID mismatch and no-live authority. Requires exact-head Money R13B CI plus independent security review and live runtime evidence.

## Owner-host requirements (NO values in repo, chats, CI logs or browser)

The host setup is separate from Vercel and Supabase. These settings belong in root-owned or dedicated service-user configuration with restrictive permissions. They are not exposed in the public client.

```sh
# Placeholder names only, do not paste credentials into chat.
PHANTOM_AGENT_OWNER_HOST_ENABLED=OWNER_CONFIRMED_READ_ONLY
PHANTOM_AGENT_OWNER_SESSION_ATTESTED=true
PHANTOM_AGENT_MCP_BINARY=/absolute/path/to/reviewed/version-pinned/phantom-mcp-executable
PHANTOM_AGENT_MCP_ARGS_JSON='[]'
PHANTOM_AGENT_PIN_WALLET_ID=<owner-pinned-mcp-agent-wallet-id>
PHANTOM_AGENT_PIN_SOLANA_ADDRESS=<owner-pinned-mcp-agent-solana-address>
PHANTOM_AGENT_OWNER_WALLETS_JSON='["<separate-owner-public-wallet-address>"]'
PHANTOM_AGENT_OBSERVER_BEARER_TOKEN=<high-entropy-private-host-to-app-token>
PHANTOM_AGENT_STUDY_JOURNAL_PATH=/private/owner-host/phantom-study.jsonl
PHANTOM_AGENT_STUDY_HMAC_KEY=<separate-32plus-character-secret>
SOLANA_RPC_URL=https://<trusted-independent-mainnet-solana-rpc>
PHANTOM_AGENT_LOCAL_PORT=43571
```

Review and install the Phantom MCP binary **manually** with a pinned package/version/digest. Complete any browser-based device-code authentication with the actual owner **before** enabling the worker. This code deliberately never invokes `phantom_login` or opens a browser login. The parent app's `PHANTOM_AGENT_OWNER_USER_ID`, `PHANTOM_AGENT_OBSERVER_URL`, `PHANTOM_AGENT_OBSERVER_BEARER_TOKEN`, `PHANTOM_AGENT_PIN_WALLET_ID`, and `PHANTOM_AGENT_PIN_SOLANA_ADDRESS` must be separately configured after private TLS proxy / network boundary is ready.

Run from the money-core workspace only after real host isolation/review:

```sh
pnpm --filter @jhadina/money-core phantom:observer:serve
pnpm --filter @jhadina/money-core verify:phantom-agent
```

The worker listens only on **127.0.0.1** and does not natively terminate TLS. Before any Vercel access, the owner must implement an authenticated and encrypted reverse proxy, firewall rules, process-level sandboxing, permission-restricted MCP session file, controlled outbound egress, version/digest verification and credential rotation. The worker strips audit and bearer credentials from the Phantom subprocess environment. It is unsafe to open the loopback endpoint to the public internet without that boundary.

## Research evidence and false-authority protections

- The agent wallet and personal Phantom owner wallet are distinct; the Coffer execution wallet is separate again.
- A Phantom API response hash is **provider observation evidence**, not independent proof of asset custody, valuation, trader profit or spendable money. The independent RPC step verifies native SOL at a confirmed slot, *not* SPL balances, token safety, price, gain, loss, or authorized signability.
- The HMAC ledger is **tamper-evident with a secret**, not immutable in an administrator-compromise scenario. Off-host encrypted backups, independently published/verifiable head digests, and isolated restore drill are required before certification. This does not modify Supabase schema.
- Reader returns `SHADOW_LEARNING_ONLY` cases with `canExecute:false`, `canAuthorizeLive:false`, `realizedPnl:null`. There is no existing SHARK/SHADOW database ingestion yet; an explicit reviewed application bridge is still necessary.
- Audit failure, stale observation, duplicate evidence, balance response mismatch, wallet identity drift or absent owner host results in BLOCKED/503, never a fallback to personal wallet or execution.
- This is deliberately a **read-only funded-or-unfunded observation** design; there is **no spend cap implemented on Phantom itself**. Do not fund an MCP wallet for automated execution and do not grant a model raw MCP access. The underlying Phantom process remains capable of signing if compromised.
- Stdio implementation currently pins the 2025-06-18 MCP protocol. A future or incompatible server must fail closed until deliberately upgraded and re-certified, not silently negotiate to a newer wire version.

## What remains blocked

1. Independent review and merge order: #1231 → #1232 → this PR.
2. Actual host and Phantom MCP process installation, owner sign-in and verified agent wallet pin.
3. Private TLS proxy, OS-level confinement, network controls, credential/session lifetime and rotation.
4. Genuine JSON-RPC result and on-chain balance receipts with verified chain/network and provenance; mocked tests are not genuine evidence.
5. Off-host encrypted snapshot, independent digest anchor, isolated restore proof, and host reboot durability.
6. An actual SHARK/SHADOW append-only ingest consumer with idempotency, case outcome tracking and source-provenance verification.
7. Full end-to-end live software read-only certification. All trading/money-moving capabilities remain NOT CERTIFIED.

Sources:
- https://docs.phantom.com/phantom-mcp-server
- https://docs.phantom.com/phantom-mcp-server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
