-- Durable, revision-fenced Director Workstation timeline authority.
-- Browser state is never canonical; all mutations advance through this store.

create table if not exists public.director_workstation_timelines (
  project_id text primary key,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  revision bigint not null check (revision >= 1),
  timeline jsonb not null,
  last_mutation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(timeline) = 'object')
);

create index if not exists director_workstation_timelines_updated_idx
  on public.director_workstation_timelines (updated_at desc);

create table if not exists public.director_workstation_timeline_events (
  id bigserial primary key,
  project_id text not null references public.director_workstation_timelines(project_id) on delete cascade,
  revision bigint not null check (revision >= 1),
  mutation_id text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (project_id, revision),
  unique (project_id, mutation_id)
);

create index if not exists director_workstation_timeline_events_project_idx
  on public.director_workstation_timeline_events (project_id, revision desc);

create table if not exists public.director_generative_region_proposals (
  id text primary key,
  project_id text not null references public.director_workstation_timelines(project_id) on delete cascade,
  timeline_revision bigint not null check (timeline_revision >= 1),
  clip_id text not null,
  start_seconds numeric not null check (start_seconds >= 0),
  duration_seconds numeric not null check (duration_seconds > 0),
  instruction text not null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','rejected','materialized','failed')),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_generative_region_proposals_project_idx
  on public.director_generative_region_proposals (project_id, created_at desc);

alter table public.director_workstation_timelines enable row level security;
alter table public.director_workstation_timeline_events enable row level security;
alter table public.director_generative_region_proposals enable row level security;

revoke all on public.director_workstation_timelines from public, anon, authenticated;
revoke all on public.director_workstation_timeline_events from public, anon, authenticated;
revoke all on public.director_generative_region_proposals from public, anon, authenticated;

grant select, insert, update on public.director_workstation_timelines to service_role;
grant select, insert on public.director_workstation_timeline_events to service_role;
grant select, insert, update on public.director_generative_region_proposals to service_role;
grant usage, select on sequence public.director_workstation_timeline_events_id_seq to service_role;

drop policy if exists director_workstation_timelines_service_role_only
  on public.director_workstation_timelines;
create policy director_workstation_timelines_service_role_only
  on public.director_workstation_timelines
  as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_workstation_timeline_events_service_role_only
  on public.director_workstation_timeline_events;
create policy director_workstation_timeline_events_service_role_only
  on public.director_workstation_timeline_events
  as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_generative_region_proposals_service_role_only
  on public.director_generative_region_proposals;
create policy director_generative_region_proposals_service_role_only
  on public.director_generative_region_proposals
  as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.save_director_workstation_timeline(
  p_project_id text,
  p_user_id uuid,
  p_expected_revision bigint,
  p_mutation_id text,
  p_timeline jsonb,
  p_reason text,
  p_now timestamptz default now()
)
returns public.director_workstation_timelines
language plpgsql
security definer
set search_path = public
as $$
declare
  role_value text;
  existing_row public.director_workstation_timelines%rowtype;
  event_exists boolean;
  next_revision bigint;
begin
  if coalesce(trim(p_project_id),'') = '' then
    raise exception 'DIRECTOR_TIMELINE_PROJECT_ID_REQUIRED';
  end if;
  if p_user_id is null then
    raise exception 'DIRECTOR_TIMELINE_USER_ID_REQUIRED';
  end if;
  if coalesce(trim(p_mutation_id),'') = '' then
    raise exception 'DIRECTOR_TIMELINE_MUTATION_ID_REQUIRED';
  end if;
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'DIRECTOR_TIMELINE_REASON_REQUIRED';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'DIRECTOR_TIMELINE_EXPECTED_REVISION_INVALID';
  end if;
  if jsonb_typeof(p_timeline) <> 'object'
     or p_timeline->>'projectId' is distinct from p_project_id then
    raise exception 'DIRECTOR_TIMELINE_PROJECT_BINDING_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id, 0));

  select role into role_value
  from public.director_project_memberships
  where project_id = p_project_id and user_id = p_user_id;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'DIRECTOR_TIMELINE_EDIT_AUTHORITY_REQUIRED';
  end if;

  select exists(
    select 1 from public.director_workstation_timeline_events
    where project_id = p_project_id and mutation_id = p_mutation_id
  ) into event_exists;

  if event_exists then
    select * into existing_row
    from public.director_workstation_timelines
    where project_id = p_project_id;
    return existing_row;
  end if;

  select * into existing_row
  from public.director_workstation_timelines
  where project_id = p_project_id
  for update;

  if found and existing_row.last_mutation_id = p_mutation_id then
    return existing_row;
  end if;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'DIRECTOR_TIMELINE_STALE_REVISION:expected=% actual=0', p_expected_revision;
    end if;
    next_revision := 1;
    insert into public.director_workstation_timelines(
      project_id, created_by_user_id, revision, timeline, last_mutation_id, created_at, updated_at
    ) values (
      p_project_id, p_user_id, next_revision, p_timeline, p_mutation_id, p_now, p_now
    )
    returning * into existing_row;
  else
    if existing_row.revision <> p_expected_revision then
      raise exception 'DIRECTOR_TIMELINE_STALE_REVISION:expected=% actual=%',
        p_expected_revision, existing_row.revision;
    end if;
    next_revision := existing_row.revision + 1;
    update public.director_workstation_timelines
    set revision = next_revision,
        timeline = p_timeline,
        last_mutation_id = p_mutation_id,
        updated_at = p_now
    where project_id = p_project_id
    returning * into existing_row;
  end if;

  insert into public.director_workstation_timeline_events(
    project_id, revision, mutation_id, actor_user_id, reason, created_at
  ) values (
    p_project_id, existing_row.revision, p_mutation_id, p_user_id, p_reason, p_now
  );

  return existing_row;
end;
$$;

revoke all on function public.save_director_workstation_timeline(
  text,uuid,bigint,text,jsonb,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.save_director_workstation_timeline(
  text,uuid,bigint,text,jsonb,text,timestamptz
) to service_role;

comment on table public.director_workstation_timelines is
'Canonical owner-scoped Director Workstation timeline aggregate. Browser state is a projection only.';
comment on table public.director_workstation_timeline_events is
'Append-only revision and mutation receipts for durable Director timeline edits.';
comment on table public.director_generative_region_proposals is
'Durable approval-bound generative edit proposals pinned to an exact Director timeline revision.';
