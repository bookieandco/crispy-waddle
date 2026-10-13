# PURSE-MCP.13–.16 — Encrypted recovery, durable research inbox, session-failure gates, independent readiness
Date: 2026-10-12 (America/Los_Angeles). Stacked on #1233 → #1232 → #1231. **Code-only, read-only. NOT LIVE CERTIFIED.**

## Changes

**.13 Encrypted continuity and isolated restore**
- `phantom-agent-encrypted-backup.ts` creates AES-256-GCM archives with separate 256-bit key, random nonce, authenticated header (wallet-study head, count and source SHA-256), and SHA-256 backup receipt.
- Restore requires an **externally trusted** archive hash and ledger head. It writes only to a new isolated file (O_EXCL, mode 0600), re-verifies the original study HMAC chain and wallet identity, and deletes the failed isolated output.
- `phantom-agent-backup-cli.ts` supplies owner-confirmed `backup` and `restore` commands; no cloud upload, network egress, or hosted restore is implied. **A locally written archive is not a verified off-host backup.**

**.14 Persistent, replay-resistant research inbox**
- `phantom-agent-research-inbox.ts`: append-only, fsynced JSONL HMAC-chain with exclusive writer lock. Accepts only the exact verified projection of `readPhantomAgentStudyForShadow`, preserving contiguous sequence, source case ID, and study lineage.
- Idempotent replays admit zero rows. Source rollback, tampered inbox, missing rows, and unsafe file permissions fail closed. The worker only replies success after independent RPC verification, study append, and research inbox ingestion all succeed.
- This is an owner-host **local** SHADOW research inbox. It is **not** yet a deployed SHARK/SHADOW database sink, classifier, strategy evaluator, prediction log, or proof of forward learning. P&L remains null; no signals can authorize trades.

**.15 Lost-session recovery**
- `RestrictedPhantomMcpStdio` now latches provider errors (including MCP `isError`) as terminal failures. It never runs `phantom_login`, silently switches wallets, retries expired sessions or unlocks a privileged transport.
- Mock regression covers remote error, child exit, subsequent request denial and no automatic login.
- Operator must independently authenticate again and restart the isolated owner worker. No credentials in GitHub, logs, chat or public frontend.

**.16 Audit-only readiness**
- `phantom-agent-readonly-certification.ts` checks 12 evidentiary categories: owner auth, wallet pin, OS isolation, private TLS, session revocation, real MCP readback, independent Solana RPC, externally confirmed encrypted archive, isolated restore, post-reboot readback, exact-head CI and independent security review.
- Even all supplied proofs produce only `READY_FOR_INDEPENDENT_OWNER_REVIEW`; `liveCommissioned=false`, `productionCertified=false`, `canExecute=false`, `financialAuthority=NONE`.
- Strict source/time/head checks do not replace a real independent auditor. Fabricated or self-attested evidence is never production certification.

## Security principles

1. Phantom's MCP session belongs to a **separate agent wallet**, not your Phantom owner/browser wallet and not Coffer's isolated trading custody.
2. The child Phantom MCP process can **technically sign**; the read-only adapter does **not** remove that underlying capability. Enforce dedicated service user/OS isolation, deny all agent access to raw MCP, protect the session, firewall egress, keep private TLS, and do not fund the wallet for unattended trading.
3. `getBalance` at `confirmed` commitment is native SOL observation only, **not** SPL asset inventory, market valuation, custody certification or spendable cash.
4. The archive + local HMAC chain is **tamper-evident**, not immutable against an administrator who controls the keys. Independently anchor the exact head, encrypted archive hash and proof of backup upload in a separate trust domain. Verify an isolated restore on the actual target host, including permission and reboot durability.
5. Rollback and replay security depend on independently retained latest head/checkpoint. Old archives with their own self-described matching hashes are not a trusted independent anchor.
6. A simulated test result or checklist is not a real Phantom login/host check. No sign, swap, trade, transfer, perpetual or provider billing tool has been invoked by this implementation.

## Operator environment (secrets server-only, do NOT paste values)

In addition to the existing .09–.12 host configuration:
```sh
PHANTOM_AGENT_SHADOW_INBOX_PATH=/private/owner-host/phantom-shadow-inbox.jsonl
PHANTOM_AGENT_RESEARCH_INBOX_HMAC_KEY=<independent-min-32-char-key>
PHANTOM_AGENT_BACKUP_KEY_HEX=<64 lowercase hex characters, 32 random key bytes>
PHANTOM_AGENT_BACKUP_ARCHIVE_PATH=/private/backup-out/phantom-study-2026-10-12.enc.json
PHANTOM_AGENT_RESTORE_DESTINATION=/isolated-recovery/phantom-study-restored.jsonl
# restore: separately sourced, trusted latest head and hash
PHANTOM_AGENT_TRUSTED_ARCHIVE_SHA256=<independent archived sha256>
PHANTOM_AGENT_TRUSTED_HEAD_DIGEST=<independent journal head digest>
```

```sh
pnpm --filter @jhadina/money-core verify:phantom-agent
pnpm --filter @jhadina/money-core phantom:backup:create
pnpm --filter @jhadina/money-core phantom:backup:restore
```

The backup CLI writes locally only. The operator must upload the encrypted archive through an explicitly authenticated backup workflow (for example the **existing** Homebase Google Drive backup flow), independently store/hash its receipt, then restore from the recovered external bytes to prove its authenticity. The CLI must never run with host privileges until credentials, storage permissions, mount location, and external backup policy have been verified.

## Current blockers

- Review and merge chain #1231 → #1232 → #1233 → this PR; exact-head CI is necessary but not sufficient.
- No commissioned owner host, verified isolated Phantom binary/version/digest, real auth, session reset evidence, private TLS proxy, independent mainnet RPC readback, external backup/restore, reboot persistence, or independently sourced live proof is asserted.
- The local SHADOW research inbox is not yet integrated into the existing broader SHARK/SHADOW durable stores or calibrated learning. Do not claim model learning from balances alone.
- No owner approval of live trades or integration to the existing Coffer execution lane is included.

## Test commands
```sh
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core verify:phantom-agent
pnpm --filter @jhadina/money-core test
pnpm --filter @jhadina/jhadina-web exec tsc --noEmit -p tsconfig.money.json
```

Notes: The HMAC key, archive key, and inbox key must be independent. Archive receipts in stdout have hashes only and `offHostCertified:false`. The study reader is the source of truth. If records diverge, block and require owner-led reconciliation rather than deleting the authoritative source.
