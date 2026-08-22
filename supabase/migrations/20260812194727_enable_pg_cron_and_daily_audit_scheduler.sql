create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.jhadina_audit_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  scheduled_for timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','running','completed','failed','blocked')),
  audit_hash text,
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_audit_runs_scheduled_idx on public.jhadina_audit_runs (scheduled_for desc);
alter table public.jhadina_audit_runs enable row level security;

create or replace function public.jhadina_schedule_daily_audit(p_run_key text, p_scheduled_for timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.jhadina_audit_runs(run_key, scheduled_for)
  values (p_run_key, p_scheduled_for)
  on conflict (run_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.jhadina_audit_runs where run_key = p_run_key;
  end if;
  return v_id;
end;
$$;
revoke all on function public.jhadina_schedule_daily_audit(text,timestamptz) from public, anon, authenticated;

select cron.schedule(
  'jhadina-daily-audit-ledger',
  '0 6 * * *',
  $$select public.jhadina_schedule_daily_audit('daily:' || to_char((now() at time zone 'UTC')::date, 'YYYY-MM-DD'), date_trunc('day', now()) + interval '6 hours')$$
)
where not exists (select 1 from cron.job where jobname = 'jhadina-daily-audit-ledger');
