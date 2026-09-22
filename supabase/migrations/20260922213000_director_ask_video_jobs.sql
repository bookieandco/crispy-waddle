-- Ask Jhadina -> Director autonomous video production jobs.
create table if not exists public.director_video_jobs (
  id text primary key,
  client_request_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  production_run_id text not null references public.director_production_runs(id) on delete restrict,
  source text not null default 'ask-jhadina' check (source in ('ask-jhadina')),
  prompt text not null check (length(btrim(prompt)) > 0),
  mode text not null check (mode in ('standard','short','faceless','long-form')),
  aspect_ratio text not null check (aspect_ratio in ('9:16','16:9','1:1')),
  target_duration_seconds numeric,
  status text not null check (status in ('queued','submitted','generating','ingesting','preview_ready','blocked','failed','cancelled')),
  current_phase text not null default 'vision',
  provider_id text,
  provider_job_id text,
  submission_state text not null default 'not_started'
    check (submission_state in ('not_started','submitting','submitted','uncertain','completed')),
  spec jsonb not null default '{}'::jsonb,
  provider_policy jsonb not null default '{}'::jsonb,
  output_asset_ids text[] not null default '{}',
  preview_asset_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);

create index if not exists director_video_jobs_project_idx
  on public.director_video_jobs(project_id, created_at desc);
create index if not exists director_video_jobs_status_idx
  on public.director_video_jobs(status, updated_at);

create table if not exists public.director_video_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.director_video_jobs(id) on delete restrict,
  event_type text not null,
  status text not null,
  provider_id text,
  provider_job_id text,
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists director_video_job_events_job_idx
  on public.director_video_job_events(job_id, created_at);

alter table public.director_video_jobs enable row level security;
alter table public.director_video_job_events enable row level security;
revoke all on public.director_video_jobs from public, anon, authenticated;
revoke all on public.director_video_job_events from public, anon, authenticated;
grant select, insert, update on public.director_video_jobs to service_role;
grant select, insert on public.director_video_job_events to service_role;

drop policy if exists director_video_jobs_service_role_only on public.director_video_jobs;
create policy director_video_jobs_service_role_only
  on public.director_video_jobs as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_video_job_events_service_role_only on public.director_video_job_events;
create policy director_video_job_events_service_role_only
  on public.director_video_job_events as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.assert_director_video_job_authority()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  membership_role text;
  run_project_id text;
begin
  select role into membership_role
  from public.director_project_memberships
  where project_id = new.project_id and user_id = new.user_id;

  if membership_role is null or membership_role not in ('owner','editor') then
    raise exception 'Director video job requires project edit authority';
  end if;

  select project_id into run_project_id
  from public.director_production_runs
  where id = new.production_run_id;

  if run_project_id is null or run_project_id <> new.project_id then
    raise exception 'Director video job production run mismatch';
  end if;

  if tg_op = 'UPDATE' then
    if old.user_id <> new.user_id or old.project_id <> new.project_id or old.production_run_id <> new.production_run_id then
      raise exception 'Director video job authority identity is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists director_video_job_authority_guard on public.director_video_jobs;
create trigger director_video_job_authority_guard
before insert or update on public.director_video_jobs
for each row execute function public.assert_director_video_job_authority();

create or replace function public.reject_director_video_job_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Director video job events are append-only';
end;
$$;

drop trigger if exists director_video_job_events_immutable on public.director_video_job_events;
create trigger director_video_job_events_immutable
before update or delete on public.director_video_job_events
for each row execute function public.reject_director_video_job_event_mutation();

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
    ('stage:'||p_job_id||':generation',p_project_id,'generation',array['stage:'||p_job_id||':previs'],'planned','{}','{}',1,p_now),
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

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'director-media','director-media',false,536870912,
  array['video/mp4','video/webm','audio/wav','audio/mpeg','application/json','text/vtt']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;
