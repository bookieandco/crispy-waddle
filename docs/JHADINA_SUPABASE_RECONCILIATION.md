# Jhadina OS Supabase Schema Reconciliation

Status: **Gate 9 reconstruction complete. Awaiting human authorization before
provisioning any clean-environment verification infrastructure or touching
production in any way.**

This document is the durable record of a multi-gate, read-only-first
investigation into drift between the live "Jhadina OS" Supabase project
(`kqbkaozfjubkjevdfvic`, "Swlc", Postgres 17, `ca-central-1`) and this
repository's tracked migrations, followed by a reconstruction of the
canonical migration history from the live schema.

**Governing principle** (established mid-investigation and followed for the
remainder of the work): we do not make production match Git. Live Supabase is
authoritative where Git is demonstrably incomplete. The objective was
Live → reconstruct → verify → commit canonical migrations → prove a clean
rebuild → only then clean up redundancy — never the other way around, and
never at the cost of destroying working OverageOS/Jhadina functionality to
make the repository look tidy.

## What Gate 9 did

Created branch `jhadina-supabase-schema-reconciliation` from `main` and wrote
20 migration files into `supabase/migrations/`, using the **exact applied SQL
text** recovered from `supabase_migrations.schema_migrations.statements` (and
cross-checked against live `pg_get_functiondef` output for every function)
during Gates 0–8B. No file content was rewritten, improved, or "cleaned up" —
every promoted file is a verbatim copy of what is actually running in
production today. No production changes were made. No migrations were run
against the live project. Nothing was dropped.

| Version | Name |
|---|---|
| 20260810060438 | create_jhadina_audit_ledger |
| 20260810060509 | lock_jhadina_audit_trigger_function |
| 20260810060748 | harden_jhadina_audit_append_path |
| 20260810164226 | create_jhadina_planning_core |
| 20260811030927 | create_jhadina_evolution_candidates |
| 20260811031424 | create_overage_runtime_core |
| 20260811031731 | harden_overage_action_execution |
| 20260811033336 | harden_jhadina_audit_ledger_head_rls |
| 20260811033529 | create_overage_jurisdiction_source_registry |
| 20260811033555 | add_federal_geography_keys_to_overage_jurisdictions |
| 20260811233914 | create_jhadina_mining_financial_events |
| 20260812000137 | create_jhadina_mining_decisions |
| 20260812192807 | create_jhadina_mining_scan_checkpoints |
| 20260812194414 | create_jhadina_mining_payout_processing |
| 20260812194650 | lock_down_mining_payout_rpc |
| 20260812194727 | enable_pg_cron_and_daily_audit_scheduler |
| 20260812194849 | add_daily_audit_ledger_indexes |
| 20260812195157 | harden_daily_audit_run_access |
| 20260814224651 | harden_jhadina_evolution_run_ledger_head |
| 20260814233342 | create_jhadina_evolution_run_ledger_authoritative |

## Quarantine actions

Two pre-existing files in `supabase/migrations/` on `main` were moved to
`supabase/quarantine/` — a directory Supabase CLI tooling never scans, so
neither can ever be replayed by accident. Both are preserved verbatim with a
warning header explaining why; neither was deleted.

### 1. `20260814000000_append_jhadina_audit_event.sql` — DANGEROUS

Creates `public.jhadina_audit_event` and a same-named
`append_jhadina_audit_event(...)` RPC with a *different signature*
(`p_actor_id text`, decision check `('allow','deny')`) than the real,
currently-running function (`p_actor_id uuid`, decision check
`('allow','deny','approval_required')`, created in
`20260810060748_harden_jhadina_audit_append_path`, which reads/writes
`public.jhadina_audit_ledger` / `public.jhadina_audit_ledger_head`). Replaying
it would create a second, disconnected, broken overload of the audit RPC
against a table nothing else reads from, and defines
`list_jhadina_audit_events`, which has no live counterpart. Identified as a
hard-stop artifact in Gate 1; never executed at any point in this
investigation.

### 2. `20260811160000_append_jhadina_evolution_run_ledger.sql` — SUPERSEDED, REPLAY-BREAKING

RPC-only (no `CREATE TABLE`). In git-history timestamp order this file would
run *before* `20260814233342_create_jhadina_evolution_run_ledger_authoritative`
— the migration that actually creates `public.jhadina_evolution_run_ledger` —
and would fail on a clean rebuild with "relation does not exist." Its
function body is fully superseded by the one `20260814233342` creates. Not a
danger to live data; quarantined purely to keep a clean-environment replay
from breaking.

## Version/name collision reconciliation (PR #78)

PR #78 shipped a migration file named
`20260814190000_create_jhadina_evolution_run_ledger_authoritative.sql`. The
migration actually applied to the live project under this content carries a
different version stamp: `20260814233342`. The two are byte-for-byte
identical in content — only the timestamp (and the fact that one exists only
in `supabase_migrations.schema_migrations`, not in any git blob) differ. This
reconciliation promotes the file under the **applied** version, `20260814233342`,
not PR #78's own `20260814190000`, so that Supabase CLI's version-tracked
tooling never sees two entries for the same content and never attempts to
replay the untracked one.

## Preserved-but-not-promoted: `jhadina_evolution_run_ledger_append`

The live database has **two** functions for appending to
`jhadina_evolution_run_ledger`:

- `append_jhadina_evolution_run_ledger` (promoted in `20260814233342` above)
  — computes `sequence`/`previous_hash`/`hash` server-side, under an advisory
  lock. This is the one every real caller uses, and hash-recomputation
  against all 5 live ledger rows confirms it is what actually wrote every
  row.
- `jhadina_evolution_run_ledger_append` (note the reversed word order) —
  trusts caller-supplied `p_sequence`, `p_previous_hash`, and `p_hash`
  without recomputing or verifying them:

  ```sql
  CREATE OR REPLACE FUNCTION public.jhadina_evolution_run_ledger_append(p_sequence integer, p_event_id text, p_run_id bigint, p_task_id text, p_type text, p_occurred_at timestamp with time zone, p_payload jsonb, p_previous_hash text, p_hash text)
   RETURNS jhadina_evolution_run_ledger
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path TO 'public'
  AS $function$
  declare
    v_prev_hash text;
    v_event public.jhadina_evolution_run_ledger;
  begin
    select hash into v_prev_hash
    from public.jhadina_evolution_run_ledger
    where run_id = p_run_id
    order by sequence desc
    limit 1;

    if coalesce(v_prev_hash, null) is distinct from p_previous_hash then
      raise exception 'Evolution ledger chain head mismatch for run %', p_run_id;
    end if;

    insert into public.jhadina_evolution_run_ledger(
      sequence,event_id,run_id,task_id,type,occurred_at,payload,previous_hash,hash
    ) values (
      p_sequence,p_event_id,p_run_id,p_task_id,p_type,p_occurred_at,p_payload,p_previous_hash,p_hash
    ) returning * into v_event;

    return v_event;
  end;
  $function$
  ```

  Created in migration `20260811181342 harden_jhadina_evolution_run_ledger`
  and never referenced again afterward. An exhaustive git-blob scan across
  every locally-reachable branch found zero callers anywhere in application
  code. Classified **obsolete/orphaned** in Gate 8B.

Per explicit instruction, this function is **preserved live, not dropped, and
not promoted into a canonical migration file** — canonicalizing it into
`supabase/migrations/` would misrepresent an orphaned artifact as an
intentional, currently-relied-upon part of the schema. It remains exactly as
it is on the live project, undocumented in migration form, pending an
explicit future decision (drop vs. formally deprecate) that this
reconciliation does not make.

## Redundant indexes — preserved, not dropped

Three indexes are confirmed redundant (a UNIQUE constraint's implicit index
already covers the same or a superset of the columns a second, explicitly
created index also covers) and were **preserved as-is** in both the live
database and the promoted migration files, per explicit instruction not to
remove any of them yet:

| Index | Table | Redundant with | Origin migration |
|---|---|---|---|
| `overage_action_envelopes_idempotency_key_uq` | `overage_action_envelopes` | the table's own `idempotency_key` UNIQUE column constraint | `20260811031731_harden_overage_action_execution` |
| `jhadina_audit_runs_daily_key_idx` | `jhadina_audit_runs` | the table's own `run_key` UNIQUE column constraint | `20260812194849_add_daily_audit_ledger_indexes` |
| `jhadina_evolution_run_ledger_run_sequence_idx` | `jhadina_evolution_run_ledger` | the `unique(run_id, sequence)` constraint added later in the same table's lineage | first created in `20260814224651_harden_jhadina_evolution_run_ledger_head` (before the table itself existed there — a plain index declared ahead of the table's real creation), then idempotently re-declared (`create index if not exists`) in `20260814233342_create_jhadina_evolution_run_ledger_authoritative` alongside the new `unique(run_id, sequence)` constraint it adds |

None of these were dropped from the live database or omitted from the
promoted migration files — they are cleanup candidates for a future,
separately-authorized pass, not acted on here.

## Not promoted (left untouched, unmoved)

- `packages/energy-opportunity-core/supabase/migrations/20260812200000_create_mining_payout_processing.sql`
  — an alternate implementation of the mining-payout checkpoint write, using
  an upsert (`on conflict (network, receiving_address) do update`) instead of
  the live/canonical explicit update-then-conditional-insert pattern, and
  different `scanner_version` handling. Per explicit instruction, this file
  is **not** promoted, replaced, or reconciled — it remains exactly as it was
  before this reconciliation.
- `packages/justice-core/supabase/migrations/20260810170000_justice_evidence.sql`
  and `apps/jhadina-web/supabase/migrations/20260810150000_codebase_graph.sql`
  — unrelated `justice_*` / `janet_codebase_*` objects, out of scope.

## Remaining work (blocked on human authorization)

The instruction for this gate ends with: "build/run the clean-environment
verification and report the exact diff... Stop at the first human
authorization gate." Building that verification means provisioning a new,
billed Supabase project or branch to apply these 20 migrations against a
clean database and diff the result against the live schema. That
provisioning step is treated as the first human-authorization gate this
instruction refers to — cost must be checked and explicitly confirmed before
any such resource is created. Nothing has been provisioned; no clean-room
diff has been run yet.
