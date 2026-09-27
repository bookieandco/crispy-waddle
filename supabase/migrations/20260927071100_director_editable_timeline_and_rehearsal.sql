-- Durable editable timeline snapshots + canonical rehearsal stage for Ask video jobs.

create table if not exists public.director_editable_timeline_snapshots (
  id text primary key,
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  parent_id text references public.director_editable_timeline_snapshots(id) on delete restrict,
  timeline jsonb not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(project_id, version)
);

create index if not exists director_editable_timeline_project_version_idx
  on public.director_editable_timeline_snapshots(project_id, version desc);

alter table public.director_editable_timeline_snapshots enable row level security;
revoke all on public.director_editable_timeline_snapshots from anon, authenticated;
grant select, insert, update, delete on public.director_editable_timeline_snapshots to service_role;

create policy director_editable_timeline_service_role_only
  on public.director_editable_timeline_snapshots
  as restrictive for all
  to service_role
  using (true)
  with check (true);

comment on table public.director_editable_timeline_snapshots is
'Append-style service-role Director timeline snapshots used for durable editability and certification receipts. User-facing mutations remain governed by Director project authority.';

create or replace function public.create_director_video_job(
  p_job_id text,
  p_client_request_id text,
  p_user_id uuid,
  p_project_id text,
  p_create_project boolean,
  p_prompt text,
  p_mode text,
  p_aspect_ratio text,
  p_target_duration_seconds numeric,
  p_spec jsonb,
  p_provider_policy jsonb,
  p_now timestamptz
)
returns public.director_video_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.director_video_jobs%rowtype;
  membership_role text;
  run_id text := 'run:' || p_job_id;
  result_row public.director_video_jobs%rowtype;
begin
  if length(btrim(p_job_id)) = 0 or length(btrim(p_client_request_id)) = 0 or length(btrim(p_project_id)) = 0 then
    raise exception 'Director video job identity required';
  end if;
  if length(btrim(p_prompt)) = 0 then
    raise exception 'Director video prompt required';
  end if;

  select * into existing
  from public.director_video_jobs
  where user_id = p_user_id and client_request_id = p_client_request_id;

  if found then
    if existing.prompt <> p_prompt then
      raise exception 'Director video client request id reused with different prompt';
    end if;
    return existing;
  end if;

  if p_create_project then
    if exists (
      select 1 from public.director_project_memberships
      where project_id = p_project_id and user_id <> p_user_id
    ) then
      raise exception 'Director project id already belongs to another user';
    end if;
    insert into public.director_project_memberships(project_id,user_id,role,created_at)
    values(p_project_id,p_user_id,'owner',p_now)
    on conflict(project_id,user_id) do update set role='owner';
  else
    select role into membership_role
    from public.director_project_memberships
    where project_id=p_project_id and user_id=p_user_id;
    if membership_role is null or membership_role not in ('owner','editor') then
      raise exception 'Director project edit authority required';
    end if;
  end if;

  insert into public.director_production_runs(
    id,project_id,status,shot_ids,gate_ids,version,created_at,updated_at
  ) values(
    run_id,p_project_id,'planning','{}','{}',1,p_now,p_now
  );

  insert into public.director_creative_stages
    (id,project_id,kind,depends_on,status,input_artifact_ids,output_artifact_ids,version,updated_at)
  values
    ('stage:'||p_job_id||':vision',p_project_id,'vision','{}','ready','{}','{}',1,p_now),
    ('stage:'||p_job_id||':treatment',p_project_id,'treatment',array['stage:'||p_job_id||':vision'],'planned','{}','{}',1,p_now),
    ('stage:'||p_job_id||':storyboard',p_project_id,'storyboard',array['stage:'||p_job_id||':treatment'],'planned','{}','{}',1,p_now),
    ('stage:'||p_job_id||':shotlist',p_project_id,'shotlist',array['stage:'||p_job_id||':storyboard'],'planned','{}','{}',1,p_now),
    ('stage:'||p_job_id||':previs',p_project_id,'previs',array['stage:'||p_job_id||':shotlist'],'planned','{}','{}',1,p_now),
    ('stage:'||p_job_id||':rehearsal',p_project_id,'rehearsal',array['stage:'||p_job_id||':previs'],'planned','{}','{}',1,p_now),
    ('stage:'||p_job_id||':generation',p_project_id,'generation',array['stage:'||p_job_id||':rehearsal'],'planned','{}','{}',1,p_now),
    ('stage:'||p_job_id||':edit',p_project_id,'edit',array['stage:'||p_job_id||':generation'],'planned','{}','{}',1,p_now),
    ('stage:'||p_job_id||':review',p_project_id,'review',array['stage:'||p_job_id||':edit'],'planned','{}','{}',1,p_now),
    ('stage:'||p_job_id||':final',p_project_id,'final',array['stage:'||p_job_id||':review'],'planned','{}','{}',1,p_now);

  insert into public.director_video_jobs(
    id,client_request_id,user_id,project_id,production_run_id,source,prompt,mode,aspect_ratio,
    target_duration_seconds,status,current_phase,spec,provider_policy,created_at,updated_at
  ) values(
    p_job_id,p_client_request_id,p_user_id,p_project_id,run_id,'ask-jhadina',p_prompt,p_mode,p_aspect_ratio,
    p_target_duration_seconds,'queued','vision',coalesce(p_spec,'{}'::jsonb),coalesce(p_provider_policy,'{}'::jsonb),p_now,p_now
  )
  returning * into result_row;

  insert into public.director_video_job_events(job_id,event_type,status,metadata,created_at)
  values(p_job_id,'created','completed',jsonb_build_object('source','ask-jhadina','projectId',p_project_id),p_now);

  return result_row;
end;
$$;

revoke all on function public.create_director_video_job(
  text,text,uuid,text,boolean,text,text,text,numeric,jsonb,jsonb,timestamptz
) from public,anon,authenticated;
grant execute on function public.create_director_video_job(
  text,text,uuid,text,boolean,text,text,text,numeric,jsonb,jsonb,timestamptz
) to service_role;
