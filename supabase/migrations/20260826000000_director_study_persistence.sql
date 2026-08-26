-- Durable state for DirectorOS autonomous study sessions.
-- Observations and learning candidates remain separate from permanent Jhadina memory.

create table if not exists public.director_studies (
  id text primary key,
  source_url text not null,
  autonomous boolean not null default true,
  share_with_jhadina boolean not null default false,
  status text not null check (status in ('queued','running','paused','completed','failed')),
  last_time_seconds numeric not null default 0 check (last_time_seconds >= 0),
  observations_seen integer not null default 0 check (observations_seen >= 0),
  notes_created integer not null default 0 check (notes_created >= 0),
  learning_candidates_created integer not null default 0 check (learning_candidates_created >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.director_study_checkpoints (
  id text primary key,
  study_id text not null references public.director_studies(id) on delete cascade,
  time_seconds numeric not null check (time_seconds >= 0),
  observations_seen integer not null default 0 check (observations_seen >= 0),
  notes_created integer not null default 0 check (notes_created >= 0),
  learning_candidates_created integer not null default 0 check (learning_candidates_created >= 0),
  created_at timestamptz not null default now()
);

create index if not exists director_study_checkpoints_latest_idx
  on public.director_study_checkpoints (study_id, time_seconds desc, created_at desc);

alter table public.director_studies enable row level security;
alter table public.director_study_checkpoints enable row level security;

create policy director_studies_service_role_only
  on public.director_studies as restrictive for all
  to service_role using (true) with check (true);

create policy director_study_checkpoints_service_role_only
  on public.director_study_checkpoints as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.director_studies from anon, authenticated;
revoke all on public.director_study_checkpoints from anon, authenticated;
