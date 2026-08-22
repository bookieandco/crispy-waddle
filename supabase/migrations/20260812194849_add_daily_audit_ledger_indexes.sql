create index if not exists jhadina_audit_runs_status_idx on public.jhadina_audit_runs (status, scheduled_for);
create unique index if not exists jhadina_audit_runs_daily_key_idx on public.jhadina_audit_runs (run_key);
