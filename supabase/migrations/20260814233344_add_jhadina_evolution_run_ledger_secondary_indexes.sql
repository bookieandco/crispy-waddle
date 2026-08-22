-- Continuation of 20260814224651_harden_jhadina_evolution_run_ledger_head.sql,
-- split out during Gate 10 (clean-replay ordering fix).
--
-- The two CREATE INDEX statements below were originally part of that
-- migration. They target public.jhadina_evolution_run_ledger, which (in
-- this reconstructed canonical history) is first created by
-- 20260814233342_create_jhadina_evolution_run_ledger_authoritative -- a
-- later migration. Moved here, unchanged, to run after that migration
-- exists.
--
-- The other three jhadina_evolution_run_ledger-referencing statements
-- originally in 20260814224651 (ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY, CREATE INDEX ... jhadina_evolution_run_ledger_run_sequence_idx,
-- and CREATE POLICY "authenticated users can read evolution run events")
-- are deliberately NOT duplicated here: 20260814233342 already performs
-- the RLS enable and an identical run_sequence_idx creation itself
-- (idempotent either way -- no index is dropped, it just now gets
-- created by 20260814233342's own statement instead), and it already
-- creates the read policy via DROP POLICY IF EXISTS + CREATE POLICY with
-- a corrected, subquery-wrapped auth.uid() USING clause that supersedes
-- 20260814224651's original version. Re-running that older, unwrapped
-- policy definition after 20260814233342 would silently overwrite the
-- live, currently-correct policy with the earlier one it was designed to
-- replace -- the opposite of preserving live behavior.
--
-- Gate 11 clean-environment verification found that jhadina_evolution_run_ledger_task_idx
-- is actually (task_id) only on live, not (task_id, occurred_at desc) as
-- originally promoted here. The two-column definition below was first
-- attempted in this same 20260814224651 migration, but by the time it ran
-- live, an index of that exact name already existed -- single-column --
-- from the table's original (un-promoted) creation in
-- 20260811181310_create_jhadina_evolution_run_ledger. CREATE INDEX IF NOT
-- EXISTS only checks the index name, not its definition, so that
-- redefinition attempt was a silent no-op live, and the original
-- single-column index is what's actually running today. Corrected here
-- during Gate 12 to match live verbatim. See
-- docs/JHADINA_SUPABASE_RECONCILIATION.md (Gate 11/Gate 12) for the full
-- rationale.

create index if not exists jhadina_evolution_run_ledger_task_idx
on public.jhadina_evolution_run_ledger(task_id);

create index if not exists jhadina_evolution_run_ledger_type_idx
on public.jhadina_evolution_run_ledger(type, occurred_at desc);
