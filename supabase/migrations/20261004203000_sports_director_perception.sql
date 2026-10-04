-- Durable Director -> Sports visual perception evidence.
-- These rows are inferred context only. They cannot establish official game state or authorize/execute wagers.

create table if not exists public.sports_director_perception_observations (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  event_id text not null,
  subject_id text not null,
  frame_id text not null,
  kind text not null,
  envelope jsonb not null,
  perception jsonb not null,
  context_feature jsonb,
  requires_official_reconciliation boolean not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(envelope)='object'),
  check (jsonb_typeof(perception)='object'),
  check (context_feature is null or jsonb_typeof(context_feature)='object')
);

create index if not exists sports_director_perception_event_idx
  on public.sports_director_perception_observations(owner_user_id,event_id,available_at desc);

alter table public.sports_director_perception_observations enable row level security;
revoke all on public.sports_director_perception_observations from public,anon,authenticated;
grant select,insert,update on public.sports_director_perception_observations to service_role;

drop policy if exists sports_director_perception_observations_service_role_only
  on public.sports_director_perception_observations;
create policy sports_director_perception_observations_service_role_only
  on public.sports_director_perception_observations
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.sports_director_perception_observations is
'Authorized video-derived Director sports observations projected into Sports as CONTEXT_ONLY inference. Betting and financial authority are always NONE.';
