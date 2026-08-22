create policy jhadina_audit_runs_select_authenticated
on public.jhadina_audit_runs
for select
using (auth.role() = 'authenticated');

revoke execute on function public.append_jhadina_evolution_run_ledger(bigint,text,text,timestamptz,jsonb) from anon, authenticated;
revoke execute on function public.verify_jhadina_evolution_run_ledger(bigint) from anon, authenticated;
