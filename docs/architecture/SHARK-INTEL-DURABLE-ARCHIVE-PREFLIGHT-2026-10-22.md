# SHARK-INTEL.DURABLE.02 — Database contract and rollout gate (review only)

**Date:** 2026-10-22. **Status:** STAGED CODE, NOT MIGRATED, NOT COMMISSIONED.
**Source branch:** \`build/shark-sniper-fastpath-rug-fingerprints-20261021\` in draft PR #1457.

## Scope and verified baseline
Current connected Jhadina Supabase contains:
- \`jhadina_shark_market_events\` (RLS enabled; requires sequence key);
- \`jhadina_trade_memory_records\` (service-only latest projection, **not** the journal);
- \`money_paper_execution_events\` (fixed event kinds, **not** a SHARK outcome memory bus).

The canonical \`money_shark_shadow_decisions\`, \`money_shark_shadow_executions\`, \`money_shark_shadow_observations\`, \`money_shark_shadow_lessons\`, \`money_shark_shadow_memory\` tables are **not confirmed present**. The existing event and trade-memory tables had 0 rows in the October 22 read-only spot check. Do not treat wallet verification as live market ingestion.

## Implemented source
- \`apps/jhadina-web/src/lib/shark/sniper-intel-journal.ts\`: canonical, owner-bound SHA-256 receipt and minimal immutable research payload; NO_TRADE and PAPER_RECORDED captured atomically in **one proposed row**. No seed, keys, signing lease, balances, raw texts or private transcript body.
- \`apps/jhadina-web/src/lib/shark/sniper-intel-journal-repository.ts\`: **service-only** Supabase table adapter; an absent table results in failure.
- \`apps/jhadina-web/src/lib/shark/sniper-intel-durable-cycle.ts\`: canonical \`runSniperPaperCycle\` followed by required archive receipt; not a second risk/financial engine.
- \`apps/jhadina-web/src/lib/shark/sniper-intel-journal.test.ts\`: duplicate replay, conflict, partial write, paper/no-trade and authority regression tests.

This does not yet persist production events. These modules are not connected to a scheduled worker or running Helius/Telegram stream and cannot be commissioned before a reviewed migration and authentication check.

## Proposed SQL shape for separately generated migration

**DO NOT APPLY THIS DDL FROM A CHAT RESPONSE.** The Supabase CLI was unavailable in this session. Generate the migration with the project's supported \`supabase migration new\` command, review this contract against latest schema, then test on an isolated branch/database. This is a review specimen, not the actual migration file.

\`\`\`sql
-- Service-only append archive. No UPDATE/DELETE grants; no client/browser calls.
create table if not exists public.money_shark_sniper_intel_archive (
  receipt_id text primary key,
  owner_id uuid not null,
  trade_id text not null,
  token_address text not null,
  information_cutoff timestamptz not null,
  payload_hash text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  constraint money_shark_sniper_archive_digest_format
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint money_shark_sniper_archive_receipt_format
    check (receipt_id ~ '^shark-intel:[0-9a-f]{64}$'),
  constraint money_shark_sniper_archive_object
    check (jsonb_typeof(payload_json) = 'object'),
  constraint money_shark_sniper_archive_authority
    check (payload_json->>'authority' = 'ARCHIVED_RESEARCH_ONLY'
      and payload_json->>'canExecute' = 'false'
      and payload_json->>'canSign' = 'false'
      and payload_json->>'canCreditPurse' = 'false'
      and payload_json->>'canMutateModel' = 'false'),
  constraint money_shark_sniper_archive_identity
    check (payload_json->>'tradeId' = trade_id
      and payload_json->>'tokenAddress' = token_address)
);
create index if not exists money_shark_sniper_archive_owner_time_idx
  on public.money_shark_sniper_intel_archive(owner_id,information_cutoff,receipt_id);
create index if not exists money_shark_sniper_archive_trade_time_idx
  on public.money_shark_sniper_intel_archive(trade_id,information_cutoff,receipt_id);
alter table public.money_shark_sniper_intel_archive enable row level security;
alter table public.money_shark_sniper_intel_archive force row level security;
revoke all on table public.money_shark_sniper_intel_archive from public;
revoke all on table public.money_shark_sniper_intel_archive from anon, authenticated, service_role;
grant select,insert on table public.money_shark_sniper_intel_archive to service_role;
-- service_role bypasses RLS, but table privileges still restrict write kind.
-- No browser role policy, no public SECURITY DEFINER function.
\`\`\`

## Preflight before applying anything
1. Verify target database and migration ordering. Recheck existing constraints, table name collision and auth user ownership.
2. Isolated DB restore or branch: apply migration once; observe table + index + grants and RLS; verify anon/auth SELECT/INSERT denied and service INSERT permitted without UPDATE/DELETE.
3. Insert a **synthetic** NO_TRADE row in an isolated transaction and roll back; preserve real financial accounts untouched. Verify JSON restrictions and conflict behavior.
4. Run the exact-head SHARK tests, including fault injection after commit and concurrent identical/conflicting insert. Build the web app with the new adapter, and check application role can only use the intended table.
5. Verify an actual authentic public mint + paper decision reaches the archive with evidence cutoff and provider identity, then replay after worker restart. The archive is not yet a Shadow learned lesson.
6. Only after the above: separately approve source worker schedule, backlog bound, retention, recovery/backup and owner/private iPhone QA. Production migration, paid infrastructure, wallet signing, funding and live orders require explicit approval.

## Remaining honest blockers
- There is no commissioned durable \`money_shark_sniper_intel_archive\` table; invoking the Supabase adapter today should fail closed.
- Source authentication and market-event timestamp/slot verification are separate from copying a provider claim into the fusion; a source-provided \`verification\` string alone is not a cryptographic attestation.
- Canonical Shadow missing schemas and old lesson partial-write/return-basis defects still require independent repair.
- Post-trade onchain outcome projection requires a *separately authenticated* settled transaction with exact trade/pair/chain binding. Neither a signed Phantom ownership message nor a paper close proves this.
- Telemetry latency and true trade outcomes are not available from the zero-row ledger baseline. No profit claim.
