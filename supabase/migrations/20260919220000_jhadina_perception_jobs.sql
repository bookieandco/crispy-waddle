-- JLLM-18O — durable asynchronous perception jobs.
-- Heavy perception never runs inside the upload HTTP request. Workers claim
-- jobs with expiring leases and fencing tokens; stale workers cannot commit.

create table if not exists public.jhadina_perception_jobs (
  id text primary key,
  actor_id text not null,
  asset_id text not null,
  intent text,
  selected_subsystems jsonb,
  status text not null default 'queued'
    check (status in ('queued','running','retry_wait','needs_selection','completed','failed')),
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 4 check (max_attempts between 1 and 20),
  available_at timestamptz not null default clock_timestamp(),
  lease_owner text,
  lease_token text,
  lease_expires_at timestamptz,
  last_error text,
  packet jsonb,
  dispatch jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (actor_id, asset_id),
  foreign key (actor_id, asset_id)
    references public.jhadina_intelligence_assets(actor_id, id)
);

create index if not exists jhadina_perception_jobs_claim_idx
  on public.jhadina_perception_jobs (status, available_at, lease_expires_at, created_at);

create index if not exists jhadina_perception_jobs_actor_idx
  on public.jhadina_perception_jobs (actor_id, created_at desc);

alter table public.jhadina_perception_jobs enable row level security;
revoke all on public.jhadina_perception_jobs from public, anon, authenticated;
grant select, insert, update on public.jhadina_perception_jobs to service_role;

create or replace function public.enqueue_jhadina_perception_job(
  p_id text,
  p_actor_id text,
  p_asset_id text,
  p_intent text,
  p_max_attempts integer
)
returns public.jhadina_perception_jobs
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_perception_jobs%rowtype;
begin
  if p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception 'PERCEPTION_JOB_MAX_ATTEMPTS_INVALID';
  end if;

  insert into public.jhadina_perception_jobs (
    id, actor_id, asset_id, intent, max_attempts
  ) values (
    p_id, p_actor_id, p_asset_id, nullif(p_intent,''), p_max_attempts
  )
  on conflict (actor_id, asset_id) do nothing;

  select * into v_row
    from public.jhadina_perception_jobs
   where actor_id = p_actor_id and asset_id = p_asset_id;

  return v_row;
end;
$$;

create or replace function public.claim_next_jhadina_perception_job(
  p_worker_id text,
  p_lease_ms integer
)
returns public.jhadina_perception_jobs
language plpgsql security definer set search_path = public
as $$
declare
  v_id text;
  v_row public.jhadina_perception_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if nullif(trim(p_worker_id),'') is null then return null; end if;

  select id into v_id
    from public.jhadina_perception_jobs
   where (
      (status in ('queued','retry_wait') and available_at <= v_now)
      or (status = 'running' and lease_expires_at is not null and lease_expires_at <= v_now)
   )
     and attempt < max_attempts
   order by available_at asc, created_at asc
   for update skip locked
   limit 1;

  if v_id is null then return null; end if;

  update public.jhadina_perception_jobs
     set status = 'running',
         attempt = attempt + 1,
         lease_owner = p_worker_id,
         lease_token = encode(gen_random_bytes(16),'hex'),
         lease_expires_at = v_now + make_interval(secs => greatest(p_lease_ms,1)::double precision / 1000),
         updated_at = v_now
   where id = v_id
   returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.renew_jhadina_perception_job_lease(
  p_job_id text,
  p_worker_id text,
  p_lease_token text,
  p_lease_ms integer
)
returns public.jhadina_perception_jobs
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_perception_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_perception_jobs
     set lease_expires_at = v_now + make_interval(secs => greatest(p_lease_ms,1)::double precision / 1000),
         updated_at = v_now
   where id = p_job_id
     and status = 'running'
     and lease_owner = p_worker_id
     and lease_token = p_lease_token
     and lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.require_jhadina_perception_job_selection(
  p_job_id text,
  p_worker_id text,
  p_lease_token text,
  p_packet jsonb
)
returns public.jhadina_perception_jobs
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_perception_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_perception_jobs
     set status = 'needs_selection',
         packet = p_packet,
         dispatch = null,
         last_error = null,
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         updated_at = v_now
   where id = p_job_id
     and status = 'running'
     and lease_owner = p_worker_id
     and lease_token = p_lease_token
     and lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.requeue_jhadina_perception_job_with_selection(
  p_actor_id text,
  p_job_id text,
  p_selected_subsystems jsonb
)
returns public.jhadina_perception_jobs
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_perception_jobs%rowtype;
begin
  if jsonb_typeof(p_selected_subsystems) <> 'array' or jsonb_array_length(p_selected_subsystems) = 0 then
    raise exception 'PERCEPTION_JOB_SELECTION_REQUIRED';
  end if;
  if exists (
    select 1
      from jsonb_array_elements_text(p_selected_subsystems) selected(value)
     where selected.value not in (
       'sports-intelligence','jhadina-media','director-studio',
       'creative-engine','overageos','knowledge','research'
     )
  ) then
    raise exception 'PERCEPTION_JOB_SELECTION_INVALID';
  end if;
  if exists (
    select 1
      from jsonb_array_elements_text(p_selected_subsystems) selected(value)
     where not exists (
       select 1
         from jsonb_array_elements(coalesce(
           (select packet->'routing'->'routes'
              from public.jhadina_perception_jobs
             where id = p_job_id and actor_id = p_actor_id),
           '[]'::jsonb
         )) route
        where route->>'subsystem' = selected.value
     )
  ) then
    raise exception 'PERCEPTION_JOB_SELECTION_NOT_PROPOSED';
  end if;
  update public.jhadina_perception_jobs
     set status = 'queued',
         selected_subsystems = p_selected_subsystems,
         available_at = clock_timestamp(),
         packet = null,
         dispatch = null,
         last_error = null,
         updated_at = clock_timestamp()
   where id = p_job_id
     and actor_id = p_actor_id
     and status = 'needs_selection'
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.complete_jhadina_perception_job(
  p_job_id text,
  p_worker_id text,
  p_lease_token text,
  p_packet jsonb,
  p_dispatch jsonb
)
returns public.jhadina_perception_jobs
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_perception_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_perception_jobs
     set status = 'completed',
         packet = p_packet,
         dispatch = p_dispatch,
         last_error = null,
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         updated_at = v_now
   where id = p_job_id
     and status = 'running'
     and lease_owner = p_worker_id
     and lease_token = p_lease_token
     and lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.retry_jhadina_perception_job(
  p_job_id text,
  p_worker_id text,
  p_lease_token text,
  p_error text,
  p_available_at timestamptz
)
returns public.jhadina_perception_jobs
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_perception_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_perception_jobs
     set status = case when attempt >= max_attempts then 'failed' else 'retry_wait' end,
         available_at = greatest(p_available_at, v_now),
         last_error = left(coalesce(p_error,''), 8000),
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         updated_at = v_now
   where id = p_job_id
     and status = 'running'
     and lease_owner = p_worker_id
     and lease_token = p_lease_token
     and lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.fail_jhadina_perception_job(
  p_job_id text,
  p_worker_id text,
  p_lease_token text,
  p_error text
)
returns public.jhadina_perception_jobs
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_perception_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_perception_jobs
     set status = 'failed',
         last_error = left(coalesce(p_error,''), 8000),
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         updated_at = v_now
   where id = p_job_id
     and status = 'running'
     and lease_owner = p_worker_id
     and lease_token = p_lease_token
     and lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.enqueue_jhadina_perception_job(text,text,text,text,integer) from public,anon,authenticated;
revoke execute on function public.claim_next_jhadina_perception_job(text,integer) from public,anon,authenticated;
revoke execute on function public.renew_jhadina_perception_job_lease(text,text,text,integer) from public,anon,authenticated;
revoke execute on function public.require_jhadina_perception_job_selection(text,text,text,jsonb) from public,anon,authenticated;
revoke execute on function public.requeue_jhadina_perception_job_with_selection(text,text,jsonb) from public,anon,authenticated;
revoke execute on function public.complete_jhadina_perception_job(text,text,text,jsonb,jsonb) from public,anon,authenticated;
revoke execute on function public.retry_jhadina_perception_job(text,text,text,text,timestamptz) from public,anon,authenticated;
revoke execute on function public.fail_jhadina_perception_job(text,text,text,text) from public,anon,authenticated;

grant execute on function public.enqueue_jhadina_perception_job(text,text,text,text,integer) to service_role;
grant execute on function public.claim_next_jhadina_perception_job(text,integer) to service_role;
grant execute on function public.renew_jhadina_perception_job_lease(text,text,text,integer) to service_role;
grant execute on function public.require_jhadina_perception_job_selection(text,text,text,jsonb) to service_role;
grant execute on function public.requeue_jhadina_perception_job_with_selection(text,text,jsonb) to service_role;
grant execute on function public.complete_jhadina_perception_job(text,text,text,jsonb,jsonb) to service_role;
grant execute on function public.retry_jhadina_perception_job(text,text,text,text,timestamptz) to service_role;
grant execute on function public.fail_jhadina_perception_job(text,text,text,text) to service_role;
