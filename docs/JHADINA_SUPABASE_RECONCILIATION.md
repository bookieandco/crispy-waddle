# Jhadina OS Supabase Schema Reconciliation

Status: **Gate 9 reconstruction complete. Gate 10 clean-replay ordering fix
complete and static preflight re-verified clean. Awaiting human authorization
before provisioning any clean-environment verification infrastructure or
touching production in any way.**

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

## Gate 10 — clean-replay ordering fix

A static preflight check (Gate 9's own verification pass) found that
collapsing the 10 intermediate evolution-run-ledger migrations into
`20260814233342_create_jhadina_evolution_run_ledger_authoritative` — while
correct for representing the final live shape — left two later migrations
referencing objects that, in the promoted/canonical file set, don't exist
until `20260814233342` runs. As the preflight report put it: this is exactly
the class of dependency issue a clean replay is supposed to expose, not a
failure of the reconstruction itself.

Two files were trimmed and two new migrations added, all git-only, nothing
executed against any database:

- **`20260812195157_harden_daily_audit_run_access.sql`** — its unrelated
  `jhadina_audit_runs_select_authenticated` policy stays in its original
  position. Its two `REVOKE EXECUTE` statements (on
  `append_jhadina_evolution_run_ledger` and
  `verify_jhadina_evolution_run_ledger`) moved verbatim to a new file,
  **`20260814233343_finish_daily_audit_run_access_hardening.sql`**, timestamped
  after `20260814233342`. No behavioral change: REVOKE is monotonic, and
  `20260814233342` already revokes ALL on both functions from
  public/anon/authenticated before granting EXECUTE to service_role — these
  two narrower revokes are a no-op confirmation of that same final state.

- **`20260814224651_harden_jhadina_evolution_run_ledger_head.sql`** — trimmed
  to only what it self-contains (creating `jhadina_evolution_run_ledger_head`,
  enabling its RLS, and its own read policy). The five statements that
  referenced `jhadina_evolution_run_ledger` (the main table, not the head
  table) were removed from here:
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and
    `jhadina_evolution_run_ledger_run_sequence_idx` are **not** duplicated
    anywhere else — `20260814233342` already performs both itself, so they
    would be pure no-ops. No index is dropped; `run_sequence_idx` still gets
    created, just by `20260814233342`'s own statement instead.
  - The `"authenticated users can read evolution run events"` policy is
    **not** duplicated either — `20260814233342` already creates it via
    `DROP POLICY IF EXISTS` + `CREATE POLICY`, with a corrected,
    subquery-wrapped `(select auth.uid())` USING clause that supersedes this
    file's original unwrapped `auth.uid()` version. Re-running the older
    version after `20260814233342` would have silently overwritten the live,
    currently-correct policy with the one it was designed to replace — the
    opposite of preserving live behavior. This is the one point where a
    literal "move every referencing statement verbatim" would have
    introduced a new bug; the fix preserves final live behavior instead.
  - The `jhadina_evolution_run_ledger_task_idx` and
    `jhadina_evolution_run_ledger_type_idx` indexes have no equivalent in
    `20260814233342`, so they moved unchanged to a new file,
    **`20260814233344_add_jhadina_evolution_run_ledger_secondary_indexes.sql`**,
    timestamped after it.

`20260814233342` itself was not modified, renamed, or renumbered.
`jhadina_evolution_run_ledger_append` was not touched. Nothing under
`supabase/quarantine/` was read or executed. No index was dropped anywhere —
every index that existed before Gate 10 still gets created, just from its
correct position in the sequence.

Re-running the same static dependency analysis (every `CREATE TABLE` /
`CREATE FUNCTION` cross-checked against every `ALTER TABLE`, `CREATE POLICY
ON`, `CREATE INDEX ON`, `REVOKE/GRANT ON FUNCTION`, and `EXECUTE FUNCTION`
reference, comment-stripped) over all 22 files in the new order found: no
duplicate table creations, no duplicate function creations, no duplicate
index declarations, and zero forward references. Full order:

1. `20260810060438_create_jhadina_audit_ledger.sql`
2. `20260810060509_lock_jhadina_audit_trigger_function.sql`
3. `20260810060748_harden_jhadina_audit_append_path.sql`
4. `20260810164226_create_jhadina_planning_core.sql`
5. `20260811030927_create_jhadina_evolution_candidates.sql`
6. `20260811031424_create_overage_runtime_core.sql`
7. `20260811031731_harden_overage_action_execution.sql`
8. `20260811033336_harden_jhadina_audit_ledger_head_rls.sql`
9. `20260811033529_create_overage_jurisdiction_source_registry.sql`
10. `20260811033555_add_federal_geography_keys_to_overage_jurisdictions.sql`
11. `20260811233914_create_jhadina_mining_financial_events.sql`
12. `20260812000137_create_jhadina_mining_decisions.sql`
13. `20260812192807_create_jhadina_mining_scan_checkpoints.sql`
14. `20260812194414_create_jhadina_mining_payout_processing.sql`
15. `20260812194650_lock_down_mining_payout_rpc.sql`
16. `20260812194727_enable_pg_cron_and_daily_audit_scheduler.sql`
17. `20260812194849_add_daily_audit_ledger_indexes.sql`
18. `20260812195157_harden_daily_audit_run_access.sql` (trimmed)
19. `20260814224651_harden_jhadina_evolution_run_ledger_head.sql` (trimmed)
20. `20260814233342_create_jhadina_evolution_run_ledger_authoritative.sql` (unchanged)
21. `20260814233343_finish_daily_audit_run_access_hardening.sql` (new)
22. `20260814233344_add_jhadina_evolution_run_ledger_secondary_indexes.sql` (new)

Clean-environment replay (provisioning a fresh Supabase project/branch to
apply these 22 migrations and diff against live) is still not started —
still gated on explicit human authorization before any cloud resource is
created, per Gate 9's original stopping point.
