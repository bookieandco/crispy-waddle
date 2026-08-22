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
-- See docs/JHADINA_SUPABASE_RECONCILIATION.md (Gate 10) for the full
-- rationale.

create index if not exists jhadina_evolution_run_ledger_task_idx
on public.jhadina_evolution_run_ledger(task_id, occurred_at desc);

create index if not exists jhadina_evolution_run_ledger_type_idx
on public.jhadina_evolution_run_ledger(type, occurred_at desc);
