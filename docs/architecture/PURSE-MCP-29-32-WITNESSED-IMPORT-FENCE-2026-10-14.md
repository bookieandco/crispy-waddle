# PURSE-MCP.29–.32 — Independently witnessed research import fence
October 14, 2026. Stacked on PR #1279, which remains stacked on the five Phantom draft PRs.

**Scope:** source-code and synthetic test security fixes only. No wallet logins, funded accounts, real Solana balances, PostgreSQL mutations, migrations, cloud host access or live trading.

## Root-cause finding

The prior `phantom-agent-runpod-research-cli.ts` verified the Ed25519-signed external checkpoint against the local HMAC journal before importing. It then called `syncRunpodPhantomResearchCases` without passing the externally witnessed journal head/count. Meanwhile the owner host can append a new study record. Consequently an importer might otherwise ingest (and report) a different newer source state than the external witness actually signed.

## Four new controls

- **.29 — Mandatory signed-head fence.** Every `syncRunpodPhantomResearchCases` caller must pass `expectedJournalHead` (SHA-256 digest) and `expectedJournalCount` (positive integer), obtained from independently verified evidence. Omitting either fails closed. The importer checks both before any database write.
- **.30 — Source drift detection.** Validate HMAC journal head/count at study read, immediately before first DB write, and after inserts/replays. Concurrent mutation produces explicit `SOURCE_CHANGED_BEFORE_WRITE` or `SOURCE_CHANGED_DURING_WRITE` failures. Writes already admitted before the latter failure may be present as **research-only** cases; a new off-host witness + idempotent reconciliation is required, rather than pretending rollback.
- **.31 — CLI double fence.** Owner-host import passes the exact head/count from `verifyExternalPhantomCheckpoint` and compares independently read-back DB case count/head against that same witness before reporting success. The separate research DB credentials and existing no-execution constraints remain required.
- **.32 — Negative-path regression and CI.** Added `phantom-agent-witness-fence.test.ts` with fixtures for signed-head mismatch, missing count, witness predating fresh journal data, mid-import append, and idempotent replay; updated older tests to the mandatory API. The Phantom read-only CI's focused suite automatically includes these cases.

## Exact chain / deployment blockers

- Prior PRs #1231, #1232, #1233, #1234, #1239, #1279 are all draft/unmerged at start of this milestone. This stacked PR remains draft pending review and CI.
- The **actual Phantom MCP server** has wallet signing tools even though the narrow adapter refuses them. Prompts or read-only API surface are **not** a substitute for OS-level isolation, controlled secret/session access and private TLS.
- Real device-code login, dedicated wallet pin, true mainnet RPC readback, external encrypted archive download, isolated restore, separate trusted witness signature and least-privilege RunPod research DB are **not operationally commissioned**.
- The research journal contains observed native SOL balance snapshots, not market prices, trading outcomes, investment returns, financial permissions, or evidence of owner payouts.
- No scheduled unattended wallet process or trade executor is enabled.

## Release discipline

Review and merge from parent to child with fresh head CI, inspect source changes and required independent security findings. A clean source-level change and green software CI establish only a **code-only** verification result. Real read-only runtime acceptance requires owner-controlled host authentication and externally verifiable receipts. No funds or production trading privileges are authorized here.

## Relevant tests

```sh
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core verify:phantom-agent
pnpm --filter @jhadina/money-core test
```

No secrets in source, GitHub Actions, chat messages or logs.
