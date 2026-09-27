-- Durable evidence for Director autonomous Study / process replication.

create table if not exists public.director_study_observations (
  id text primary key,
  study_id text not null references public.director_studies(id) on delete cascade,
  asset_id text not null,
  kind text not null,
  start_seconds numeric not null check (start_seconds >= 0),
  end_seconds numeric not null check (end_seconds >= start_seconds),
  payload jsonb not null default '{}'::jsonb,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists director_study_observations_study_time_idx
  on public.director_study_observations(study_id, start_seconds, id);

alter table public.director_study_observations enable row level security;
revoke all on public.director_study_observations from anon, authenticated;
grant select, insert, update, delete on public.director_study_observations to service_role;

create policy director_study_observations_service_role_only
  on public.director_study_observations
  as restrictive for all
  to service_role
  using (true)
  with check (true);

comment on table public.director_study_observations is
'Durable evidence emitted by Director Study workers. Observations are evidence only and grant no production, memory, or publication authority.';
