-- Durable Entertainment/Director media study and taste evidence.
-- Observation is not truth; taste candidates do not affect production until explicitly approved.

create table if not exists public.jhadina_entertainment_media (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  media_type text not null check (media_type in ('youtube','movie','music','jhadina_work')),
  title text not null,
  creator text,
  source_uri text not null,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  provenance jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.jhadina_entertainment_observations (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  media_id text not null references public.jhadina_entertainment_media(id) on delete cascade,
  domain text not null check (domain in ('music','visual','story','editing','performance','writing','design')),
  technique text not null,
  start_ms bigint,
  end_ms bigint,
  measurement jsonb,
  interpretation text not null,
  evidence jsonb not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  check (start_ms is null or start_ms >= 0),
  check (end_ms is null or end_ms >= 0)
);

create index if not exists jhadina_entertainment_observations_media_idx
  on public.jhadina_entertainment_observations(owner_user_id,media_id,created_at);

create table if not exists public.jhadina_entertainment_feedback (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  target_id text not null references public.jhadina_entertainment_observations(id) on delete cascade,
  signal text not null check (signal in ('positive','negative')),
  scope text not null check (scope in ('media','scene','segment','technique')),
  reason text,
  created_at timestamptz not null
);

create table if not exists public.jhadina_entertainment_preferences (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  hypothesis_id text not null,
  domain text not null check (domain in ('music','visual','story','editing','performance','writing','design')),
  preference text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  provenance text[] not null default '{}',
  approved_at timestamptz not null,
  unique(owner_user_id,hypothesis_id)
);

create table if not exists public.director_cinematic_notes (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  media_id text not null references public.jhadina_entertainment_media(id) on delete cascade,
  title text,
  body text not null,
  kind text not null check (kind in ('general','shot','camera','edit','sound','lighting','performance','transition')),
  start_seconds numeric,
  end_seconds numeric,
  frame_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (start_seconds is null or start_seconds >= 0),
  check (end_seconds is null or end_seconds >= 0)
);

create index if not exists director_cinematic_notes_media_idx
  on public.director_cinematic_notes(owner_user_id,media_id,created_at desc);

alter table public.jhadina_entertainment_media enable row level security;
alter table public.jhadina_entertainment_observations enable row level security;
alter table public.jhadina_entertainment_feedback enable row level security;
alter table public.jhadina_entertainment_preferences enable row level security;
alter table public.director_cinematic_notes enable row level security;

revoke all on public.jhadina_entertainment_media from public,anon,authenticated;
revoke all on public.jhadina_entertainment_observations from public,anon,authenticated;
revoke all on public.jhadina_entertainment_feedback from public,anon,authenticated;
revoke all on public.jhadina_entertainment_preferences from public,anon,authenticated;
revoke all on public.director_cinematic_notes from public,anon,authenticated;

grant select,insert,update on public.jhadina_entertainment_media to service_role;
grant select,insert,update on public.jhadina_entertainment_observations to service_role;
grant select,insert on public.jhadina_entertainment_feedback to service_role;
grant select,insert,update on public.jhadina_entertainment_preferences to service_role;
grant select,insert,update on public.director_cinematic_notes to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'jhadina_entertainment_media','jhadina_entertainment_observations',
    'jhadina_entertainment_feedback','jhadina_entertainment_preferences','director_cinematic_notes'
  ] loop
    execute format('drop policy if exists %I_service_role_only on public.%I',t,t);
    execute format('create policy %I_service_role_only on public.%I as restrictive for all to service_role using (true) with check (true)',t,t);
  end loop;
end $$;
