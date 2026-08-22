-- Gate 12 correction. Gate 11 clean-environment verification found two
-- objects present on live public.jhadina_evolution_run_ledger that were
-- never captured in the Gate 8B manifest and never promoted into any of
-- the 20 canonical migrations:
--
-- 1. jhadina_evolution_run_ledger_occurred_at_idx -- created in the
--    table's original (un-promoted) creation migration,
--    20260811163602_create_jhadina_evolution_run_ledger, and never
--    dropped since. Still live today.
-- 2. jhadina_evolution_run_ledger_service_role_access -- created in
--    20260811163628_harden_jhadina_evolution_run_ledger, and never
--    dropped since. Still live today.
--
-- Both statements below are the exact original definitions from those
-- two migrations, verbatim, added here (after 20260814233342 creates the
-- table) to bring the reconstructed canonical history into structural
-- parity with live. See docs/JHADINA_SUPABASE_RECONCILIATION.md (Gate 11
-- / Gate 12) for the full rationale.

create index if not exists jhadina_evolution_run_ledger_occurred_at_idx
  on public.jhadina_evolution_run_ledger (occurred_at desc);

create policy jhadina_evolution_run_ledger_service_role_access
on public.jhadina_evolution_run_ledger
as permissive
for all
to service_role
using (true)
with check (true);
