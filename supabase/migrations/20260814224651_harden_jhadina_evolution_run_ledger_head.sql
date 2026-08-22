create table if not exists public.jhadina_evolution_run_ledger_head (
  singleton boolean primary key default true check (singleton),
  sequence bigint not null default 0,
  event_hash text,
  updated_at timestamptz not null default now()
);

insert into public.jhadina_evolution_run_ledger_head(singleton, sequence, event_hash)
values (true, 0, null)
on conflict (singleton) do nothing;

alter table public.jhadina_evolution_run_ledger_head enable row level security;

create policy "authenticated users can read evolution ledger head"
on public.jhadina_evolution_run_ledger_head for select to authenticated
using (true);

-- The statements that originally followed here all referenced
-- public.jhadina_evolution_run_ledger (not this file's own
-- jhadina_evolution_run_ledger_head table): ALTER TABLE ... ENABLE ROW
-- LEVEL SECURITY, CREATE POLICY "authenticated users can read evolution
-- run events", and CREATE INDEX for run_sequence_idx / task_idx /
-- type_idx. In this reconstructed canonical history, jhadina_evolution_run_ledger
-- is first created by 20260814233342_create_jhadina_evolution_run_ledger_authoritative,
-- a later migration -- so those statements would fail against a clean
-- database if left here. Moved during Gate 10 (clean-replay ordering
-- fix):
--   - RLS enable and the run_sequence_idx index are NOT duplicated
--     elsewhere: 20260814233342 already performs both itself (its own
--     ALTER TABLE ... ENABLE ROW LEVEL SECURITY and an identical
--     `create index if not exists jhadina_evolution_run_ledger_run_sequence_idx`),
--     so re-stating them after it would be a pure no-op. No index is
--     dropped -- run_sequence_idx still gets created, just by
--     20260814233342's own statement instead of this one.
--   - The read policy is NOT duplicated either: 20260814233342 already
--     creates it via DROP POLICY IF EXISTS + CREATE POLICY with a
--     corrected, subquery-wrapped `(select auth.uid())` USING clause that
--     supersedes this file's original `auth.uid()` version. Re-running
--     this file's older definition after 20260814233342 would silently
--     overwrite the live, currently-correct policy with the exact
--     definition it was written to replace -- the opposite of preserving
--     live behavior.
--   - The task_idx and type_idx indexes have no equivalent in
--     20260814233342, so they were preserved (unchanged) in
--     20260814233344_add_jhadina_evolution_run_ledger_secondary_indexes.sql,
--     sequenced to run after it.
-- See docs/JHADINA_SUPABASE_RECONCILIATION.md (Gate 10) for the full
-- rationale.
