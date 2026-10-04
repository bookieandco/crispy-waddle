-- Durable Business Factory -> Director autopilot receipts.
-- Supervisor advances only already-authorized machine-safe steps and records every boundary.

create table if not exists public.director_business_autopilot_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  production_run_id text,
  plan_id text not null,
  action text not null,
  status text not null check (status in ('advanced','waiting','blocked','failed','noop')),
  boundary text not null,
  details jsonb not null default '{}'::jsonb,
  error text,
  observed_at timestamptz not null default now()
);

create index if not exists director_business_autopilot_project_idx
  on public.director_business_autopilot_receipts(project_id,observed_at desc);

create index if not exists director_business_autopilot_owner_idx
  on public.director_business_autopilot_receipts(owner_user_id,observed_at desc);

alter table public.director_business_autopilot_receipts enable row level security;
revoke all on public.director_business_autopilot_receipts from public,anon,authenticated;
grant select,insert on public.director_business_autopilot_receipts to service_role;

drop policy if exists director_business_autopilot_receipts_service_role_only
  on public.director_business_autopilot_receipts;
create policy director_business_autopilot_receipts_service_role_only
  on public.director_business_autopilot_receipts
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_business_autopilot_receipts is
'Append-only audit of autonomous Director production advancement. Does not grant creative, publication, paid-media, or financial authority.';
