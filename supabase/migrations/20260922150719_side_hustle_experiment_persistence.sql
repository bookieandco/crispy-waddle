create table if not exists public.jhadina_side_hustle_experiments (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  status text not null check (status in ('planned','running','completed','cancelled')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create unique index if not exists jhadina_side_hustle_experiments_one_active_idx
  on public.jhadina_side_hustle_experiments (user_id, opportunity_id)
  where status in ('planned','running');

create index if not exists jhadina_side_hustle_experiments_opportunity_idx
  on public.jhadina_side_hustle_experiments (user_id, opportunity_id, updated_at desc);

create table if not exists public.jhadina_side_hustle_experiment_observations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  experiment_id text not null,
  opportunity_id text not null,
  observed_at timestamptz not null,
  spend double precision not null check (spend >= 0),
  hours double precision not null check (hours >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, experiment_id)
    references public.jhadina_side_hustle_experiments(user_id, id) on delete cascade,
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_side_hustle_experiment_observations_experiment_idx
  on public.jhadina_side_hustle_experiment_observations (user_id, experiment_id, observed_at);

alter table public.jhadina_side_hustle_experiments enable row level security;
alter table public.jhadina_side_hustle_experiment_observations enable row level security;

drop policy if exists "jhadina_side_hustle_experiments_select_own"
  on public.jhadina_side_hustle_experiments;
create policy "jhadina_side_hustle_experiments_select_own"
  on public.jhadina_side_hustle_experiments
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jhadina_side_hustle_experiment_observations_select_own"
  on public.jhadina_side_hustle_experiment_observations;
create policy "jhadina_side_hustle_experiment_observations_select_own"
  on public.jhadina_side_hustle_experiment_observations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.jhadina_side_hustle_experiment_create(
  p_experiment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_opportunity public.jhadina_opportunities%rowtype;
  v_id text := p_experiment->>'id';
  v_opportunity_id text := p_experiment->>'opportunityId';
  v_now timestamptz := now();
  v_created_at timestamptz;
  v_payload jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_experiment) <> 'object' then raise exception 'experiment payload must be an object'; end if;
  if coalesce(v_id,'') = '' then raise exception 'experiment id is required'; end if;
  if coalesce(v_opportunity_id,'') = '' then raise exception 'opportunity id is required'; end if;
  if coalesce(p_experiment->>'status','') <> 'planned' then raise exception 'new experiment must be planned'; end if;
  if coalesce((p_experiment->>'requiresApproval')::boolean, false) is not true then
    raise exception 'experiment requires approval';
  end if;
  if coalesce(p_experiment->>'hypothesis','') = ''
     or coalesce(p_experiment->>'targetCustomer','') = ''
     or coalesce(p_experiment->>'channel','') = ''
     or coalesce(p_experiment->>'offer','') = ''
     or coalesce(p_experiment->>'currency','') = '' then
    raise exception 'experiment hypothesis, target customer, channel, offer, and currency are required';
  end if;
  if jsonb_typeof(p_experiment->'successCriteria') <> 'array'
     or jsonb_array_length(p_experiment->'successCriteria') = 0 then
    raise exception 'experiment requires success criteria';
  end if;
  if jsonb_typeof(coalesce(p_experiment->'killCriteria','[]'::jsonb)) <> 'array' then
    raise exception 'kill criteria must be an array';
  end if;
  if jsonb_typeof(p_experiment->'evidenceRefs') <> 'array'
     or jsonb_array_length(p_experiment->'evidenceRefs') = 0
     or exists (
       select 1
       from jsonb_array_elements(p_experiment->'evidenceRefs') as evidence_ref
       where jsonb_typeof(evidence_ref) <> 'string'
          or btrim(evidence_ref #>> '{}') = ''
     ) then
    raise exception 'experiment requires non-empty evidence refs';
  end if;
  if coalesce((p_experiment->>'maxSpend')::double precision, -1) < 0
     or coalesce((p_experiment->>'maxHours')::double precision, 0) <= 0
     or coalesce((p_experiment->>'maxDurationDays')::integer, 0) <= 0
     or coalesce((p_experiment->>'minimumObservations')::integer, 0) <= 0 then
    raise exception 'experiment bounds are invalid';
  end if;

  v_created_at := nullif(p_experiment->>'createdAt','')::timestamptz;
  if v_created_at is null then raise exception 'experiment createdAt is required'; end if;

  select *
    into v_opportunity
    from public.jhadina_opportunities
   where user_id = v_user and id = v_opportunity_id
   for update;

  if not found then raise exception 'opportunity not found'; end if;
  if v_opportunity.status in ('won','lost','expired','rejected','superseded') then
    raise exception 'closed opportunity cannot start validation';
  end if;
  if jsonb_typeof(v_opportunity.payload->'metadata'->'sideHustleProfile') <> 'object' then
    raise exception 'canonical side hustle profile is required';
  end if;
  if coalesce(v_opportunity.payload->'metadata'->'sideHustleProfile'->>'role','') = 'capability' then
    raise exception 'capability-only profile cannot be validated as a standalone business';
  end if;
  if p_experiment->'profile' is distinct from v_opportunity.payload->'metadata'->'sideHustleProfile' then
    raise exception 'experiment profile does not match canonical opportunity profile';
  end if;

  v_payload := p_experiment;
  insert into public.jhadina_side_hustle_experiments (
    user_id, id, opportunity_id, status, payload,
    created_at, started_at, completed_at, updated_at
  ) values (
    v_user, v_id, v_opportunity_id, 'planned', v_payload,
    v_created_at, null, null, v_now
  );

  return v_payload;
end;
$$;

create or replace function public.jhadina_side_hustle_experiment_start(
  p_experiment_id text,
  p_started_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_side_hustle_experiments%rowtype;
  v_payload jsonb;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if coalesce(p_experiment_id,'') = '' then raise exception 'experiment id is required'; end if;
  if p_started_at is null then raise exception 'startedAt is required'; end if;

  select * into v_row
    from public.jhadina_side_hustle_experiments
   where user_id = v_user and id = p_experiment_id
   for update;

  if not found then raise exception 'experiment not found'; end if;
  if v_row.status <> 'planned' then raise exception 'only planned experiments can start'; end if;
  if p_started_at < v_row.created_at then raise exception 'experiment cannot start before it was created'; end if;

  v_payload := jsonb_set(v_row.payload, '{status}', '"running"'::jsonb, true);
  v_payload := jsonb_set(v_payload, '{startedAt}', to_jsonb(p_started_at), true);

  update public.jhadina_side_hustle_experiments
     set status = 'running',
         payload = v_payload,
         started_at = p_started_at,
         updated_at = v_now
   where user_id = v_user and id = p_experiment_id;

  return v_payload;
end;
$$;

create or replace function public.jhadina_side_hustle_experiment_record_observation(
  p_observation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_experiment public.jhadina_side_hustle_experiments%rowtype;
  v_id text := p_observation->>'id';
  v_experiment_id text := p_observation->>'experimentId';
  v_observed_at timestamptz;
  v_spend double precision;
  v_hours double precision;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_observation) <> 'object' then raise exception 'observation payload must be an object'; end if;
  if coalesce(v_id,'') = '' then raise exception 'observation id is required'; end if;
  if coalesce(v_experiment_id,'') = '' then raise exception 'experiment id is required'; end if;
  if jsonb_typeof(p_observation->'metrics') <> 'object' then raise exception 'observation metrics are required'; end if;
  if exists (
    select 1
    from jsonb_each(p_observation->'metrics') as metric
    where jsonb_typeof(metric.value) <> 'number'
  ) then
    raise exception 'observation metrics must be numeric';
  end if;
  if jsonb_typeof(p_observation->'evidenceRefs') <> 'array'
     or jsonb_array_length(p_observation->'evidenceRefs') = 0
     or exists (
       select 1
       from jsonb_array_elements(p_observation->'evidenceRefs') as evidence_ref
       where jsonb_typeof(evidence_ref) <> 'string'
          or btrim(evidence_ref #>> '{}') = ''
     ) then
    raise exception 'observation requires non-empty evidence refs';
  end if;

  v_observed_at := nullif(p_observation->>'observedAt','')::timestamptz;
  v_spend := (p_observation->>'spend')::double precision;
  v_hours := (p_observation->>'hours')::double precision;
  if v_observed_at is null then raise exception 'observedAt is required'; end if;
  if v_spend < 0 or v_hours < 0 then raise exception 'observation spend and hours must be non-negative'; end if;

  select * into v_experiment
    from public.jhadina_side_hustle_experiments
   where user_id = v_user and id = v_experiment_id
   for update;

  if not found then raise exception 'experiment not found'; end if;
  if v_experiment.status <> 'running' then raise exception 'experiment must be running'; end if;
  if v_experiment.started_at is null or v_observed_at < v_experiment.started_at then
    raise exception 'observation cannot predate experiment start';
  end if;

  insert into public.jhadina_side_hustle_experiment_observations (
    user_id, id, experiment_id, opportunity_id, observed_at,
    spend, hours, payload
  ) values (
    v_user, v_id, v_experiment_id, v_experiment.opportunity_id, v_observed_at,
    v_spend, v_hours, p_observation
  );

  return p_observation;
end;
$$;

create or replace function public.jhadina_side_hustle_experiment_complete(
  p_experiment_id text,
  p_completed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_side_hustle_experiments%rowtype;
  v_payload jsonb;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if coalesce(p_experiment_id,'') = '' then raise exception 'experiment id is required'; end if;
  if p_completed_at is null then raise exception 'completedAt is required'; end if;

  select * into v_row
    from public.jhadina_side_hustle_experiments
   where user_id = v_user and id = p_experiment_id
   for update;

  if not found then raise exception 'experiment not found'; end if;
  if v_row.status <> 'running' then raise exception 'only running experiments can complete'; end if;
  if v_row.started_at is null or p_completed_at < v_row.started_at then
    raise exception 'experiment cannot complete before it started';
  end if;

  v_payload := jsonb_set(v_row.payload, '{status}', '"completed"'::jsonb, true);
  v_payload := jsonb_set(v_payload, '{completedAt}', to_jsonb(p_completed_at), true);

  update public.jhadina_side_hustle_experiments
     set status = 'completed',
         payload = v_payload,
         completed_at = p_completed_at,
         updated_at = v_now
   where user_id = v_user and id = p_experiment_id;

  return v_payload;
end;
$$;

revoke all on table public.jhadina_side_hustle_experiments from anon;
revoke all on table public.jhadina_side_hustle_experiment_observations from anon;
revoke all on table public.jhadina_side_hustle_experiments from authenticated;
revoke all on table public.jhadina_side_hustle_experiment_observations from authenticated;

grant select on table public.jhadina_side_hustle_experiments to authenticated;
grant select on table public.jhadina_side_hustle_experiment_observations to authenticated;
grant all on table public.jhadina_side_hustle_experiments to service_role;
grant all on table public.jhadina_side_hustle_experiment_observations to service_role;

revoke all on function public.jhadina_side_hustle_experiment_create(jsonb) from public, anon;
revoke all on function public.jhadina_side_hustle_experiment_start(text, timestamptz) from public, anon;
revoke all on function public.jhadina_side_hustle_experiment_record_observation(jsonb) from public, anon;
revoke all on function public.jhadina_side_hustle_experiment_complete(text, timestamptz) from public, anon;

grant execute on function public.jhadina_side_hustle_experiment_create(jsonb) to authenticated, service_role;
grant execute on function public.jhadina_side_hustle_experiment_start(text, timestamptz) to authenticated, service_role;
grant execute on function public.jhadina_side_hustle_experiment_record_observation(jsonb) to authenticated, service_role;
grant execute on function public.jhadina_side_hustle_experiment_complete(text, timestamptz) to authenticated, service_role;
