-- Director Workstation durable timeline authority + generative edit proposals.
-- Reuses director_editable_timeline_snapshots as the canonical append-only timeline ledger.

create or replace function public.persist_director_editable_timeline_snapshot(
  p_snapshot_id text,
  p_project_id text,
  p_user_id uuid,
  p_expected_version integer,
  p_timeline jsonb,
  p_evidence_ids jsonb default '[]'::jsonb,
  p_now timestamptz default now()
)
returns public.director_editable_timeline_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_role text;
  canonical_owner uuid;
  latest public.director_editable_timeline_snapshots%rowtype;
  result_row public.director_editable_timeline_snapshots%rowtype;
  next_version integer;
begin
  if length(btrim(p_snapshot_id))=0 or length(btrim(p_project_id))=0 then
    raise exception 'DIRECTOR_TIMELINE_IDENTITY_REQUIRED';
  end if;
  if p_expected_version < 0 then
    raise exception 'DIRECTOR_TIMELINE_EXPECTED_VERSION_INVALID';
  end if;
  if coalesce(p_timeline->>'projectId','') <> p_project_id then
    raise exception 'DIRECTOR_TIMELINE_PROJECT_MISMATCH';
  end if;

  select role into membership_role
  from public.director_project_memberships
  where project_id=p_project_id and user_id=p_user_id;
  if membership_role is null or membership_role not in ('owner','editor') then
    raise exception 'DIRECTOR_PROJECT_EDIT_AUTHORITY_REQUIRED';
  end if;

  select user_id into canonical_owner
  from public.director_project_memberships
  where project_id=p_project_id and role='owner'
  order by created_at asc
  limit 1;
  if canonical_owner is null then
    raise exception 'DIRECTOR_PROJECT_OWNER_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id, 0));

  select * into latest
  from public.director_editable_timeline_snapshots
  where project_id=p_project_id
  order by version desc
  limit 1;

  if found then
    if latest.version <> p_expected_version then
      raise exception 'DIRECTOR_TIMELINE_VERSION_CONFLICT:%:%', latest.version, p_expected_version;
    end if;
    next_version := latest.version + 1;
  else
    if p_expected_version <> 0 then
      raise exception 'DIRECTOR_TIMELINE_VERSION_CONFLICT:0:%', p_expected_version;
    end if;
    next_version := 1;
  end if;

  insert into public.director_editable_timeline_snapshots(
    id,project_id,owner_user_id,version,parent_id,timeline,evidence_ids,created_at
  ) values(
    p_snapshot_id,p_project_id,canonical_owner,next_version,
    case when found then latest.id else null end,
    p_timeline,coalesce(p_evidence_ids,'[]'::jsonb),p_now
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.persist_director_editable_timeline_snapshot(
  text,text,uuid,integer,jsonb,jsonb,timestamptz
) from public,anon,authenticated;
grant execute on function public.persist_director_editable_timeline_snapshot(
  text,text,uuid,integer,jsonb,jsonb,timestamptz
) to service_role;

create table if not exists public.director_generative_region_proposals (
  id text primary key,
  project_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_id text not null,
  start_seconds numeric not null check(start_seconds >= 0),
  duration_seconds numeric not null check(duration_seconds > 0),
  instruction text not null check(length(btrim(instruction)) > 0),
  operation text not null default 'replace'
    check(operation in ('extend','replace','remove','insert','fill','reframe','retime')),
  status text not null default 'pending_approval'
    check(status in ('pending_approval','approved','rejected','submitted','completed','failed')),
  source_timeline_version integer not null check(source_timeline_version > 0),
  result_asset_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_generative_region_project_created_idx
  on public.director_generative_region_proposals(project_id,created_at desc);

alter table public.director_generative_region_proposals enable row level security;
revoke all on public.director_generative_region_proposals from anon,authenticated;
grant select,insert,update,delete on public.director_generative_region_proposals to service_role;

create policy director_generative_region_service_role_only
  on public.director_generative_region_proposals
  as restrictive for all
  to service_role
  using(true)
  with check(true);

comment on table public.director_generative_region_proposals is
'Owner-scoped durable Workstation generative-edit proposals. Creation never grants generation or timeline-mutation authority.';
