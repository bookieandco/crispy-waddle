-- ONE-RUNTIME.4: durable latest-known capability runtime truth.
-- This is descriptive health state only. It grants no execution permission.
create table if not exists public.jhadina_capability_runtime_status (
  capability_name text primary key,
  subsystem_id text,
  state text not null check (state in (
    'unknown','ready','degraded','blocked','simulation-only','paper-only','disabled'
  )),
  reason text,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  updated_at timestamptz not null
);

alter table public.jhadina_capability_runtime_status enable row level security;
revoke all on public.jhadina_capability_runtime_status from anon, authenticated;
grant select, insert, update on public.jhadina_capability_runtime_status to service_role;
revoke delete, truncate on public.jhadina_capability_runtime_status from service_role;

comment on table public.jhadina_capability_runtime_status is
  'Latest admitted ONE-RUNTIME capability health. READY still requires canonical live-runtime evidence validation in CapabilityRegistry.';
