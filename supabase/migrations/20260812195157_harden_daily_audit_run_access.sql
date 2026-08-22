create policy jhadina_audit_runs_select_authenticated
on public.jhadina_audit_runs
for select
using (auth.role() = 'authenticated');

-- The two REVOKE EXECUTE statements that originally followed here (on
-- append_jhadina_evolution_run_ledger and verify_jhadina_evolution_run_ledger)
-- were moved to 20260814233343_finish_daily_audit_run_access_hardening.sql
-- during Gate 10 (clean-replay ordering fix): in this reconstructed
-- canonical history both functions are first created by
-- 20260814233342_create_jhadina_evolution_run_ledger_authoritative, a
-- later migration, so revoking execute on them here would fail against a
-- clean database. See docs/JHADINA_SUPABASE_RECONCILIATION.md.
