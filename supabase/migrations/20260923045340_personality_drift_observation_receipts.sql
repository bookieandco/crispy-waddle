-- PERSONALITY-MEMORY.FINAL observation-only longitudinal drift receipts.

create table if not exists public.jhadina_personality_drift_receipts (
  id text primary key,
  user_id text not null,
  request_id text not null,
  evaluated_at timestamptz not null,
  expected jsonb not null,
  observed jsonb not null,
  assessment jsonb not null,
  authority text not null check (authority = 'observation_only'),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create index if not exists jhadina_personality_drift_user_time_idx
  on public.jhadina_personality_drift_receipts (user_id, evaluated_at desc);

alter table public.jhadina_personality_drift_receipts enable row level security;

drop policy if exists jhadina_personality_drift_service_role_only
  on public.jhadina_personality_drift_receipts;

create policy jhadina_personality_drift_service_role_only
  on public.jhadina_personality_drift_receipts as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_personality_drift_receipts from anon, authenticated;
grant select, insert, update on public.jhadina_personality_drift_receipts to service_role;
