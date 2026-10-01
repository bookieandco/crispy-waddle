-- LOCAL-GOV.5B — remaining national buyer registry state and official domain hints.

alter table public.jhadina_public_jurisdictions
  add column if not exists official_domain_hints text[] not null default array[]::text[];

create table if not exists public.jhadina_public_buyer_registry_state (
  registry_id text primary key,
  status text not null check (status in ('healthy','degraded','failed','fixture_review_required','disabled')),
  source_url text not null,
  checkpoint jsonb not null default '{}'::jsonb,
  health jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  last_run_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.jhadina_public_buyer_registry_state enable row level security;
revoke all on table public.jhadina_public_buyer_registry_state from anon, authenticated;
grant all on table public.jhadina_public_buyer_registry_state to service_role;
