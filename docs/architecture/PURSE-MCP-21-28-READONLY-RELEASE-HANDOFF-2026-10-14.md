# PURSE-MCP.21–.28 — Read-only recovery and integration safeguards
October 14, 2026 · Stacked on PR #1239 (#1234 → #1233 → #1232 → #1231).

This is **code-only**. Neither GitHub CI nor a test-only receipt is evidence of an authenticated Phantom wallet, a commissioned owner host, an external backup, independent custody proof or permission to trade.

## Executed coding targets

| Target | Implemented change | Boundary |
| --- | --- | --- |
| **.21 — Separate DB credentials** | `validatePhantomResearchDatabaseUrl` and the owner research-import CLI require `PHANTOM_RESEARCH_DATABASE_URL` with a separate PostgreSQL principal and `sslmode=verify-full`, rather than reusing `SHARK_SHADOW_DATABASE_URL`. | No connection to a real database has been attempted. The host and CA configuration need review. |
| **.22 — Privilege admission** | `assertPhantomResearchDatabaseRole` checks the authenticated principal is non-superuser, cannot create database/schema/roles, has SELECT+INSERT only on the dedicated observation table, and cannot mutate other Money/RunPod tables. The CLI runs this check **before import**. | Requires real database grants; no migration has been applied. |
| **.23 — Study head completeness** | The RunPod importer verifies the full HMAC study-ledger count and exact most recent digest against the research inbox before any inserts. | An incomplete but valid prefix is rejected; no P&L or trading signal is generated. |
| **.24 — Owner-host directory safety** | Owner-host Phantom binary and session file preflight checks all directory ancestors for symlinks or unsafe write rights; root-owned sticky directories are permitted only as non-immediate ancestors. | Does not replace OS sandboxing, protected package dependencies, signed executable provenance or TOCTOU-safe binary execution. |
| **.25 — Database read-after-write** | `verifyRunpodPhantomResearchReadback` independently reads the wallet’s persisted research rows in slot order and compares exact case ID, parent ID, payload and forced false financial-authority flags. CLI only reports success after readback. | No real database readback has been completed. |
| **.26 — Replay and integrity recovery** | Idempotent case replays, contiguous case ancestry, cardinality mismatch, missing rows, changed balances, devnet labels and unexpected live-authority flags are regression-tested as fail-closed conditions. | Owner-led reconciliation is required for real corruption or split-brain, never silently repair financial evidence. |
| **.27 — Dedicated CI** | `.github/workflows/phantom-purse-readonly-certification.yml` adds frozen dependencies, typechecking and the focused Phantom no-execution test suite at the exact PR head, without deploying, logging credentials or launching a wallet session. | A passing job only establishes software test results. |
| **.28 — Merge/release gate** | `evaluatePhantomMergeReadiness` checks ordered parent PRs, merge status, reviews, exact-head CI, real host readback and independently verified restoration. Always returns `canExecute:false`, `canFundWallet:false`, `canAuthorizeTrading:false`. | All five predecessors are draft and unmerged as checked at implementation start. A synthetic checklist cannot produce deployment approval. |

## Required review and commissioning order

1. Independently review five prior Phantom PRs in order: [#1231](https://github.com/bookieandco/crispy-waddle/pull/1231) → [#1232](https://github.com/bookieandco/crispy-waddle/pull/1232) → [#1233](https://github.com/bookieandco/crispy-waddle/pull/1233) → [#1234](https://github.com/bookieandco/crispy-waddle/pull/1234) → [#1239](https://github.com/bookieandco/crispy-waddle/pull/1239), then this PR. Merge only after independent review and conflict resolution, with fresh exact-head runs after rebasing.
2. Commission an owner-controlled isolated host. Install a reviewed and hash-pinned Phantom MCP executable under a dedicated nonroot account. Verify OS isolation, session file ownership, credential rotation, and private TLS endpoint; no direct web/client/raw-MCP exposure to Jhadina.
3. The owner completes a real Phantom device-code session and independently pins the separate agent wallet ID and Solana address. **Do not fund the agent wallet** for a read-only test. Prove independent mainnet genesis and confirmed native SOL readback, then expiry/revocation and restart behavior.
4. Produce a genuine external encrypted backup, independently witness its digest, download the remote ciphertext and restore on a separate controlled host. Record and validate original versus restored HMAC journal head, wallet identity and restored bytes, plus reboot persistence.
5. Review migration `033_runpod_phantom_agent_readonly_research.sql`, apply it to the intended **research-only PostgreSQL instance** manually, and configure a dedicated non-superuser role allowed `SELECT`/`INSERT` only on the new table. Audit all privileges. Never use Coffer executor, generic SHARK or Supabase service-role credentials.
6. Configure the **server-only** `PHANTOM_RESEARCH_DATABASE_URL` using a validated TLS trust root and the dedicated role. Do not commit or paste connection strings. Run `pnpm --filter @jhadina/money-core phantom:research:import` only after a separately signed external checkpoint has been validated.
7. Confirm inserted/replayed counts, read-after-write case equality, no execution path, and independent proof receipts. No automatic live funds movement or unattended trades are authorized.

## Verification commands

```sh
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core verify:phantom-agent
pnpm --filter @jhadina/money-core test
pnpm --filter @jhadina/money-core build
```

The local tests intentionally use mock database responses, synthetic wallet identities, generated test keys and temporary local files. They make no external financial requests. No real session, real blockchain readback, remote archived bytes, data migration, or app deployment is claimed by a green CI run.

**Financial authority stays NONE.** Personal Phantom, dedicated agent wallet and Coffer execution custody remain separate. The SHADOW research import represents observed native SOL balances only; it does not generate predictions, realized P&L, signed transactions, orders or owner distributions.
