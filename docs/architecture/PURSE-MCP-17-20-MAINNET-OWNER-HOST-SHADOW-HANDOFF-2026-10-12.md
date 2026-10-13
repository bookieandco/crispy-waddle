# PURSE-MCP.17–.20 — Owner host, Solana mainnet, externally witnessed recovery, RunPod research bridge
Date: October 12–13, 2026 (America/Los_Angeles). Stacked on PR #1234 → #1233 → #1232 → #1231. **CODE ONLY.** No Phantom login, secrets shared, funds moved, deployments, trading permission, or external backup actually made.

## Existing family and state
The four previous Phantom PRs build the account discovery, narrow read-only MCP stdio transport, private loopback worker, independently verified native SOL observations, host-only HMAC audit ledger, encrypted local restore, idempotent research inbox, and review-only commissioning checks. Each prior change retains an explicit **NO EXECUTION** policy. All previous branches remain draft and unmerged; exact-head CI does not make the combined stack production certified.

The Phantom MCP **agent wallet** is separate from the user's personal browser Phantom wallet and the Coffer execution wallet. Never import this identity into an owner-wallet record or give SHARK/SHADOW the raw MCP subprocess.

## What was implemented in this PR

### .17 — Trusted owner-host admission
- `phantom-agent-host-preflight.ts` verifies a preapproved SHA-256 of the exact executable bytes, absolute non-symlink path, owner UID, no group/world-writable binary or immediate parent directory, user-executable bit, and permission-restricted session file without reading session bytes.
- Owner worker requires a nonroot UID and runs this preflight **before spawn**.
- New required owner-host settings: `PHANTOM_AGENT_MCP_BINARY_SHA256` (64 lowercase hex, independently sourced) and `PHANTOM_AGENT_SESSION_FILE` (absolute pathname, mode 0600). Binary must be an actual reviewed, pinned executable; any wrapper/script used for package startup must itself be reviewed and hashed.
- This does not prove full chain-of-parent-directory integrity, sandboxing, pinned dependencies within a wrapper, session confidentiality against same UID, or a trusted build/signature; an independent runtime security review is still mandatory.

### .18 — Mainnet proof before balance readback
- `phantom-agent-chain-verification.ts` now calls Solana JSON-RPC `getGenesisHash` before `getBalance`; rejects anything except the documented **mainnet-beta** genesis `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
- Existing authenticated Phantom MCP wallet ID/address pins, 120-second freshness and confirmed native SOL balance checks still apply. An injected testnet/devnet endpoint cannot be admitted as mainnet just because it answers `getBalance`.
- Tests assert mainnet check precedes the balance read and devnet failure prevents downstream balance acceptance.
- Sources: https://solana.com/docs/rpc/http/getgenesishash ; https://github.com/solana-labs/solana/blob/master/sdk/src/genesis_config.rs
- An RPC's **reported** genesis hash is not independent attestation of the operator; provider selection and network integrity require a separately trusted endpoint.

### .19 — Off-host witness and backup anchoring
- `phantom-agent-external-checkpoint.ts` verifies **Ed25519 detached signatures** from an independently pinned witness public key over exact schema, wallet ID/address, journal head/count, archive SHA-256, provider receipt ID, Git head, and witness time.
- The verifier compares signed head/count to locally HMAC-verified study journal. A signature from an off-host-held private key gives tamper evidence against simple local replacement *if* the latest signed head was stored outside the compromised host.
- **No witness private key** or signing method is exposed to Jhadina or the worker.
- A valid signature alone does **not** verify the remote provider really stored bytes; `verifiedExternalUpload:false` and `isolatedRestoreVerified:false` remain explicit. An independent owner/assessor must inspect actual remote object receipt/version and successfully restore downloaded ciphertext at a physically isolated destination.
- Keys are never posted in chat or committed to GitHub.

### .20 — SHARK/SHADOW research-only database bridge
- `033_runpod_phantom_agent_readonly_research.sql` adds a **separate** RunPod/Postgres observation table (not a live SHADOW trade or profit table). `authority='SHADOW_LEARNING_ONLY'`, `can_execute=false`, `can_authorize_live=false` enforced by SQL constraints; update/delete rejected, public grants revoked.
- `phantom-agent-runpod-research-ingest.ts` reads the HMAC-verified local inbox, admits strict native SOL research cases only, inserts with content conflict checking, returns idempotent replay receipts. No action-order, permit, allocation, market-price or P&L path is called.
- `phantom-agent-runpod-research-cli.ts` is a gated owner-host operator command. It requires a separate signed external checkpoint bound to the current ledger head, expected archive digest and exact approved Git SHA before opening a dedicated research Postgres connection. It replays only the research-only inbox.
- Connection uses the existing `SHARK_SHADOW_DATABASE_URL` convention; require a **new, dedicated least-privilege non-superuser** DB credential that has only `SELECT`/`INSERT` on the new table. Do not give the Phantom worker a database role that can change SHARK decision or execution tables. The new migration is **not applied** and actual DB connectivity is **not probed** by this PR.
- The bridge does not integrate wallet observations into the existing strategy scoring, predictions or realized performance. It provides research evidence that can later be consumed after methodology review.

## Manual operator sequence (future; no live implementation claimed)

1. Independently review the PR stack (oldest first), validate exact merged SHA, and re-run frozen-install CI. Do **not** merge only because unit tests are green.
2. Commission a real isolated owner host, pin the reviewed Phantom MCP executable package version/digest, protect its session file and OS identity, establish a non-public TLS gateway, and verify egress/UID/rollback controls.
3. Owner manually authenticates with Phantom and pins the returned dedicated **agent** wallet ID/address; never reuse the personal wallet or Coffer signer. Fund **zero** for this phase.
4. Perform real read-only login/status/address/balance readback and verify separate **mainnet** `getGenesisHash`, `getBalance` with confirmed commitment. Store independent receipts and demonstrate session revocation/zero automatic re-login.
5. Copy the encrypted local journal archive to an independent external location. Download back and conduct a true isolated restoration. Have a separate witness sign exact archive SHA, external object receipt/version, journal head/count and Git head, then preserve the newest signed checkpoint in a different trust domain. Do not count a simulated signature as an external upload.
6. Independently review and **manually apply migration 033** on the intended RunPod research-only database; grant SELECT+INSERT only to a dedicated importer principal (not the general model, web client, Coffer signer or broker worker), and verify actual permissions.
7. Only then use `pnpm --filter @jhadina/money-core phantom:research:import` on the isolated owner host with a verified, pinned signed checkpoint. Inspect exact inserted/replayed case counts; do not compute P&L from wallet balances.
8. Perform security, negative-path, reboot durability and restore tests. The 12-point independent commissioning gate must still be evaluated from real evidence. Keep signing and trading disabled.

New CLI-required server-only env variable names (no values in this document): `PHANTOM_AGENT_MCP_BINARY_SHA256`, `PHANTOM_AGENT_SESSION_FILE`, `PHANTOM_AGENT_RESEARCH_DB_IMPORT_ENABLED=OWNER_APPROVED_READ_ONLY`, `PHANTOM_AGENT_EXTERNAL_CHECKPOINT_PATH`, `PHANTOM_AGENT_APPROVED_GIT_HEAD`, `PHANTOM_AGENT_WITNESS_PUBKEY_PEM`, `PHANTOM_AGENT_TRUSTED_ARCHIVE_SHA256`, `SHARK_SHADOW_DATABASE_URL`. Previous owner-worker PIN/HMAC/inbox/backup variables are retained. Any real values must be loaded from a protected secret store.

## Certification scope and limits
- All tests for this PR use mocks/synthetic wallets/keys, not a live authenticated Phantom session.
- No real remote backup, upload receipt, signed off-host checkpoint, RunPod migration deployment, third-party penetration test, rootless OS isolation or attested restore was completed.
- Do not treat a fake/test witness signature as independent evidence, an observed balance as spendable Coffer cash, or host file-mode checks as a hardened wallet custody platform.
- No live permission to sign, rebalance, trade, transfer, pay quota, open leverage or use existing owner funds exists.
- Next target is **independent human review and actual read-only host commissioning**, not more autonomous trading surface.
