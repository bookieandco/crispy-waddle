-- K-1.4.6H / K-1.4.6I
-- Durable lease fencing, task state, provider idempotency, and hard budget accounting.

create extension if not exists pgcrypto;

alter table public.jhadina_research_execution_leases
  add column if not exists last_sequence_no bigint not null default 0,
  add column if not exists spent_cost numeric not null default 0,
  add column if not exists accrued_risk numeric not null default 0,
  add column if not exists query_count integer not null default 0,
  add column if not exists source_count integer not null default 0,
  add column if not exists evidence_count integer not null default 0,
  add column if not exists retry_count integer not null default 0,
  add column if not exists max_depth_seen integer not null default 0,
  add column if not exists max_breadth_seen integer not null default 0,
  add column if not exists wall_clock_ms bigint not null default 0;

create table if not exists public.jhadina_research_task_states (
  plan_id uuid not null references public.jhadina_research_plans(id) on delete restrict,
  task_id text not null,
  state text not null default 'ready',
  attempt_count integer not null default 0,
  evidence_ids jsonb not null default '[]'::jsonb,
  spent_cost numeric not null default 0,
  accrued_risk numeric not null default 0,
  last_lease_id uuid references public.jhadina_research_execution_leases(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (plan_id, task_id),
  constraint jhadina_research_task_state_ck check (state in ('blocked','ready','running','completed','failed','abstained')),
  constraint jhadina_research_task_attempt_ck check (attempt_count >= 0),
  constraint jhadina_research_task_cost_ck check (spent_cost >= 0),
  constraint jhadina_research_task_risk_ck check (accrued_risk >= 0)
);

create table if not exists public.jhadina_research_provider_submissions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jhadina_research_plans(id) on delete restrict,
  lease_id uuid not null references public.jhadina_research_execution_leases(id) on delete restrict,
  task_id text not null,
  provider_id text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'reserved',
  provider_job_id text,
  worker_id text not null,
  attempt integer not null default 1,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jhadina_research_provider_submission_status_ck
    check (status in ('reserved','submitted','recovery_required','failed')),
  constraint jhadina_research_provider_submission_attempt_ck check (attempt > 0),
  constraint jhadina_research_provider_submission_uq unique(provider_id, idempotency_key)
);

create index if not exists jhadina_research_task_states_state_idx
  on public.jhadina_research_task_states(plan_id, state, updated_at);
create index if not exists jhadina_research_provider_submissions_recovery_idx
  on public.jhadina_research_provider_submissions(status, updated_at)
  where status in ('reserved','recovery_required');

alter table public.jhadina_research_task_states enable row level security;
alter table public.jhadina_research_provider_submissions enable row level security;

revoke all on public.jhadina_research_task_states from public, anon, authenticated;
revoke all on public.jhadina_research_provider_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.jhadina_research_task_states to service_role;
grant select, insert, update, delete on public.jhadina_research_provider_submissions to service_role;
grant select, insert, update on public.jhadina_research_execution_leases to service_role;
grant select, insert on public.jhadina_research_execution_events to service_role;
grant select, update on public.jhadina_research_plans to service_role;
grant select on public.jhadina_research_policy_decisions to service_role;
grant select, update on public.jhadina_execution_receipts to service_role;

drop policy if exists jhadina_research_task_states_service_role on public.jhadina_research_task_states;
create policy jhadina_research_task_states_service_role
  on public.jhadina_research_task_states for all to service_role
  using (true) with check (true);
drop policy if exists jhadina_research_provider_submissions_service_role on public.jhadina_research_provider_submissions;
create policy jhadina_research_provider_submissions_service_role
  on public.jhadina_research_provider_submissions for all to service_role
  using (true) with check (true);

create or replace function public.jhadina_get_research_runtime_plan(p_plan_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'id', p.id,
    'intent_id', p.intent_id,
    'plan_version', p.plan_version,
    'tasks', coalesce((
      select jsonb_agg(
        task.value ||
        jsonb_build_object(
          'state', coalesce(s.state, 'ready'),
          'evidenceIds', coalesce(s.evidence_ids, '[]'::jsonb)
        )
        order by task.ordinality
      )
      from jsonb_array_elements(p.tasks) with ordinality as task(value, ordinality)
      left join public.jhadina_research_task_states s
        on s.plan_id = p.id and s.task_id = task.value->>'id'
    ), '[]'::jsonb),
    'budget', p.budget,
    'status', p.status
  )
  from public.jhadina_research_plans p
  where p.id = p_plan_id;
$$;

create or replace function public.jhadina_claim_research_execution(
  p_plan_id uuid,
  p_policy_decision_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_plan public.jhadina_research_plans%rowtype;
  v_decision public.jhadina_research_policy_decisions%rowtype;
  v_receipt public.jhadina_execution_receipts%rowtype;
  v_existing public.jhadina_research_execution_leases%rowtype;
  v_lease public.jhadina_research_execution_leases%rowtype;
  v_attempt integer;
  v_token text;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then return null; end if;
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then return null; end if;

  select * into v_plan from public.jhadina_research_plans where id = p_plan_id for update;
  if not found or v_plan.status not in ('approved','running') or v_plan.content_hash is null then return null; end if;

  select * into v_decision
  from public.jhadina_research_policy_decisions
  where id = p_policy_decision_id and plan_id = p_plan_id;
  if not found
     or v_decision.decision <> 'allow'
     or not v_decision.admitted_for_execution
     or v_decision.capability <> 'research.run'
     or v_decision.audit_receipt_id is null
  then return null; end if;

  select * into v_receipt
  from public.jhadina_execution_receipts
  where receipt_id = v_decision.audit_receipt_id;
  if not found
     or v_receipt.capability <> 'research.run'
     or v_receipt.approval_state <> 'APPROVED'
     or v_receipt.execution_state <> 'NOT_EXECUTED'
  then return null; end if;

  select * into v_existing
  from public.jhadina_research_execution_leases
  where plan_id = p_plan_id and state = 'active'
  for update;

  if found then
    if v_existing.expires_at > now() then
      if v_existing.worker_id = p_worker_id and v_existing.policy_decision_id = p_policy_decision_id then
        return jsonb_build_object(
          'planId', v_existing.plan_id,
          'policyDecisionId', v_existing.policy_decision_id,
          'leaseId', v_existing.id,
          'leaseToken', v_existing.lease_token,
          'workerId', v_existing.worker_id,
          'expiresAt', v_existing.expires_at
        );
      end if;
      return null;
    end if;
    update public.jhadina_research_execution_leases
       set state = 'expired', updated_at = now()
     where id = v_existing.id;
  end if;

  select coalesce(max(attempt_count),0)+1 into v_attempt
  from public.jhadina_research_execution_leases
  where plan_id = p_plan_id;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.jhadina_research_execution_leases(
    plan_id, policy_decision_id, lease_token, worker_id, expires_at,
    attempt_count, budget_snapshot, bounds_snapshot, lineage, last_sequence_no
  ) values (
    p_plan_id, p_policy_decision_id, v_token, p_worker_id,
    now() + make_interval(secs => p_lease_seconds),
    v_attempt, v_plan.budget,
    jsonb_build_object(
      'breadth', v_plan.breadth,
      'depth', v_plan.depth,
      'stopping_criteria', v_plan.stopping_criteria
    ),
    jsonb_build_object(
      'policyDecisionId', p_policy_decision_id,
      'planContentHash', v_plan.content_hash,
      'admittedAt', now()
    ),
    1
  )
  returning * into v_lease;

  insert into public.jhadina_research_execution_events(
    plan_id, lease_id, sequence_no, event_type, payload
  ) values (
    p_plan_id, v_lease.id, 1, 'admitted',
    jsonb_build_object('workerId', p_worker_id, 'attempt', v_attempt)
  );

  update public.jhadina_research_plans set status = 'running' where id = p_plan_id;

  return jsonb_build_object(
    'planId', v_lease.plan_id,
    'policyDecisionId', v_lease.policy_decision_id,
    'leaseId', v_lease.id,
    'leaseToken', v_lease.lease_token,
    'workerId', v_lease.worker_id,
    'expiresAt', v_lease.expires_at
  );
end;
$$;

create or replace function public.jhadina_renew_research_execution_lease(
  p_lease_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare v_lease public.jhadina_research_execution_leases%rowtype;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then return null; end if;
  update public.jhadina_research_execution_leases
     set expires_at = now() + make_interval(secs => p_lease_seconds),
         renewed_at = now(),
         updated_at = now()
   where id = p_lease_id
     and state = 'active'
     and worker_id = p_worker_id
     and lease_token = p_lease_token
     and expires_at > now()
  returning * into v_lease;
  if not found then return null; end if;
  return jsonb_build_object(
    'planId', v_lease.plan_id,
    'policyDecisionId', v_lease.policy_decision_id,
    'leaseId', v_lease.id,
    'leaseToken', v_lease.lease_token,
    'workerId', v_lease.worker_id,
    'expiresAt', v_lease.expires_at
  );
end;
$$;

create or replace function public.jhadina_reserve_research_provider_submission(
  p_plan_id uuid,
  p_lease_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_task_id text,
  p_provider_id text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_lease public.jhadina_research_execution_leases%rowtype;
  v_existing public.jhadina_research_provider_submissions%rowtype;
  v_row public.jhadina_research_provider_submissions%rowtype;
  v_hash text;
  v_task_exists boolean;
begin
  if p_task_id is null or p_provider_id is null or p_idempotency_key is null or p_request_hash is null then return null; end if;
  select * into v_lease from public.jhadina_research_execution_leases where id = p_lease_id for update;
  if not found or v_lease.plan_id <> p_plan_id or v_lease.state <> 'active'
     or v_lease.worker_id <> p_worker_id or v_lease.lease_token <> p_lease_token
     or v_lease.expires_at <= now() then return null; end if;

  select exists(
    select 1
    from public.jhadina_research_plans p,
         jsonb_array_elements(p.tasks) t
    where p.id = p_plan_id and t->>'id' = p_task_id
  ) into v_task_exists;
  if not v_task_exists then return null; end if;

  v_hash := encode(extensions.digest(p_request_hash, 'sha256'), 'hex');
  select * into v_existing
  from public.jhadina_research_provider_submissions
  where provider_id = p_provider_id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.plan_id <> p_plan_id or v_existing.task_id <> p_task_id or v_existing.request_hash <> v_hash then
      return null;
    end if;
    return jsonb_build_object(
      'id', v_existing.id, 'planId', v_existing.plan_id, 'leaseId', v_existing.lease_id,
      'taskId', v_existing.task_id, 'providerId', v_existing.provider_id,
      'idempotencyKey', v_existing.idempotency_key, 'status', v_existing.status,
      'providerJobId', v_existing.provider_job_id
    );
  end if;

  insert into public.jhadina_research_provider_submissions(
    plan_id, lease_id, task_id, provider_id, idempotency_key, request_hash, worker_id
  ) values (
    p_plan_id, p_lease_id, p_task_id, p_provider_id, p_idempotency_key, v_hash, p_worker_id
  ) returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id, 'planId', v_row.plan_id, 'leaseId', v_row.lease_id,
    'taskId', v_row.task_id, 'providerId', v_row.provider_id,
    'idempotencyKey', v_row.idempotency_key, 'status', v_row.status,
    'providerJobId', v_row.provider_job_id
  );
end;
$$;

create or replace function public.jhadina_commit_research_execution_event(
  p_plan_id uuid,
  p_lease_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_event_type text,
  p_task_id text default null,
  p_payload jsonb default '{}'::jsonb,
  p_usage jsonb default '{}'::jsonb,
  p_content_hash text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_lease public.jhadina_research_execution_leases%rowtype;
  v_plan public.jhadina_research_plans%rowtype;
  v_event_id uuid;
  v_seq bigint;
  v_cost numeric := coalesce((p_usage->>'cost')::numeric, 0);
  v_risk numeric := coalesce((p_usage->>'risk')::numeric, 0);
  v_queries integer := coalesce((p_usage->>'queries')::integer, 0);
  v_sources integer := coalesce((p_usage->>'sources')::integer, 0);
  v_evidence integer := coalesce((p_usage->>'evidence')::integer, 0);
  v_retries integer := coalesce((p_usage->>'retries')::integer, 0);
  v_depth integer := coalesce((p_usage->>'depth')::integer, 0);
  v_breadth integer := coalesce((p_usage->>'breadth')::integer, 0);
  v_wall bigint := coalesce((p_usage->>'wallClockMs')::bigint, 0);
  n_cost numeric;
  n_risk numeric;
  n_queries integer;
  n_sources integer;
  n_evidence integer;
  n_retries integer;
  n_depth integer;
  n_breadth integer;
  n_wall bigint;
  m_cost numeric;
  m_risk numeric;
  m_queries integer;
  m_sources integer;
  m_evidence integer;
  m_retries integer;
  m_wall bigint;
  v_reason text;
  v_task_state text;
  v_total_tasks integer;
  v_completed_tasks integer;
begin
  if p_event_type not in ('task_started','source_queried','evidence_captured','task_completed','contradiction_found','stopped','completed','failed') then
    return jsonb_build_object('accepted',false,'stopped',false,'reason','invalid_event_type');
  end if;
  if least(v_cost,v_risk,v_queries,v_sources,v_evidence,v_retries,v_depth,v_breadth,v_wall) < 0 then
    return jsonb_build_object('accepted',false,'stopped',false,'reason','negative_usage');
  end if;

  select * into v_lease
  from public.jhadina_research_execution_leases
  where id = p_lease_id
  for update;

  if not found or v_lease.plan_id <> p_plan_id or v_lease.state <> 'active'
     or v_lease.worker_id <> p_worker_id or v_lease.lease_token <> p_lease_token
     or v_lease.expires_at <= now() then
    return jsonb_build_object('accepted',false,'stopped',false,'reason','lease_fenced');
  end if;

  select * into v_plan from public.jhadina_research_plans where id = p_plan_id for update;
  if not found or v_plan.status not in ('approved','running') then
    return jsonb_build_object('accepted',false,'stopped',false,'reason','plan_not_running');
  end if;
  if coalesce(v_lease.lineage->>'planContentHash','') <> coalesce(v_plan.content_hash,'') then
    update public.jhadina_research_execution_leases set state='fenced', updated_at=now() where id=p_lease_id;
    return jsonb_build_object('accepted',false,'stopped',true,'reason','plan_content_hash_changed');
  end if;

  if p_task_id is not null and not exists (
    select 1 from jsonb_array_elements(v_plan.tasks) t where t->>'id' = p_task_id
  ) then
    return jsonb_build_object('accepted',false,'stopped',false,'reason','unknown_task');
  end if;

  n_cost := v_lease.spent_cost + v_cost;
  n_risk := v_lease.accrued_risk + v_risk;
  n_queries := v_lease.query_count + v_queries;
  n_sources := v_lease.source_count + v_sources;
  n_evidence := v_lease.evidence_count + v_evidence;
  n_retries := v_lease.retry_count + v_retries;
  n_depth := greatest(v_lease.max_depth_seen, v_depth);
  n_breadth := greatest(v_lease.max_breadth_seen, v_breadth);
  n_wall := v_lease.wall_clock_ms + v_wall;

  m_cost := coalesce((v_lease.budget_snapshot->>'maxCost')::numeric,(v_lease.budget_snapshot->>'max_cost')::numeric,0);
  m_risk := coalesce((v_lease.budget_snapshot->>'maxRisk')::numeric,(v_lease.budget_snapshot->>'max_risk')::numeric,0);
  m_queries := coalesce((v_lease.budget_snapshot->>'maxQueries')::integer,(v_lease.budget_snapshot->>'max_queries')::integer,(v_lease.bounds_snapshot->'stopping_criteria'->>'maxQueries')::integer,0);
  m_sources := coalesce((v_lease.budget_snapshot->>'maxSources')::integer,(v_lease.budget_snapshot->>'max_sources')::integer,(v_lease.bounds_snapshot->'stopping_criteria'->>'maxSources')::integer,0);
  m_evidence := coalesce((v_lease.budget_snapshot->>'maxEvidence')::integer,(v_lease.budget_snapshot->>'max_evidence')::integer,(v_lease.bounds_snapshot->'stopping_criteria'->>'maxEvidence')::integer,0);
  m_retries := coalesce((v_lease.budget_snapshot->>'maxRetries')::integer,(v_lease.budget_snapshot->>'max_retries')::integer,(v_lease.bounds_snapshot->'stopping_criteria'->>'maxRetries')::integer,0);
  m_wall := coalesce((v_lease.budget_snapshot->>'maxWallClockMs')::bigint,(v_lease.budget_snapshot->>'max_wall_clock_ms')::bigint,(v_lease.bounds_snapshot->'stopping_criteria'->>'maxWallClockMs')::bigint,0);

  if n_cost > m_cost then v_reason := 'cost_budget_exhausted';
  elsif n_risk > m_risk then v_reason := 'risk_budget_exhausted';
  elsif v_queries > 0 and n_queries > m_queries then v_reason := 'query_budget_exhausted';
  elsif v_sources > 0 and n_sources > m_sources then v_reason := 'source_budget_exhausted';
  elsif v_evidence > 0 and n_evidence > m_evidence then v_reason := 'evidence_budget_exhausted';
  elsif v_retries > 0 and n_retries > m_retries then v_reason := 'retry_budget_exhausted';
  elsif v_depth > 0 and n_depth > v_plan.depth then v_reason := 'depth_budget_exhausted';
  elsif v_breadth > 0 and n_breadth > v_plan.breadth then v_reason := 'breadth_budget_exhausted';
  elsif v_wall > 0 and n_wall > m_wall then v_reason := 'time_budget_exhausted';
  end if;

  v_seq := v_lease.last_sequence_no + 1;

  if v_reason is not null then
    update public.jhadina_research_execution_leases
       set state='fenced', last_sequence_no=v_seq,
           spent_cost=n_cost, accrued_risk=n_risk, query_count=n_queries,
           source_count=n_sources, evidence_count=n_evidence, retry_count=n_retries,
           max_depth_seen=n_depth, max_breadth_seen=n_breadth, wall_clock_ms=n_wall,
           updated_at=now()
     where id=p_lease_id;

    insert into public.jhadina_research_execution_events(
      plan_id, lease_id, sequence_no, event_type, task_id, payload,
      expected_budget, actual_usage, result_status
    ) values (
      p_plan_id,p_lease_id,v_seq,'budget_exhausted',p_task_id,
      jsonb_build_object('reason',v_reason),
      v_lease.budget_snapshot,
      jsonb_build_object('cost',n_cost,'risk',n_risk,'queries',n_queries,'sources',n_sources,'evidence',n_evidence,'retries',n_retries,'depth',n_depth,'breadth',n_breadth,'wallClockMs',n_wall),
      'fenced'
    ) returning id into v_event_id;

    return jsonb_build_object('accepted',false,'stopped',true,'reason',v_reason,'eventId',v_event_id,'sequenceNo',v_seq);
  end if;

  if p_task_id is not null then
    select state into v_task_state
    from public.jhadina_research_task_states
    where plan_id=p_plan_id and task_id=p_task_id
    for update;

    if p_event_type='task_started' then
      if found and v_task_state='completed' then
        return jsonb_build_object('accepted',false,'stopped',false,'reason','task_already_completed');
      end if;
      insert into public.jhadina_research_task_states(plan_id,task_id,state,attempt_count,last_lease_id,started_at,updated_at)
      values(p_plan_id,p_task_id,'running',1,p_lease_id,now(),now())
      on conflict(plan_id,task_id) do update
        set state='running', attempt_count=public.jhadina_research_task_states.attempt_count+1,
            last_lease_id=p_lease_id, started_at=now(), updated_at=now();
    elsif p_event_type='task_completed' then
      if not found or v_task_state <> 'running' then
        return jsonb_build_object('accepted',false,'stopped',false,'reason','task_not_running');
      end if;
      update public.jhadina_research_task_states
         set state='completed', spent_cost=spent_cost+v_cost, accrued_risk=accrued_risk+v_risk,
             completed_at=now(), updated_at=now()
       where plan_id=p_plan_id and task_id=p_task_id;
    elsif p_event_type='failed' then
      insert into public.jhadina_research_task_states(plan_id,task_id,state,attempt_count,last_lease_id,updated_at)
      values(p_plan_id,p_task_id,'failed',1,p_lease_id,now())
      on conflict(plan_id,task_id) do update set state='failed',last_lease_id=p_lease_id,updated_at=now();
    end if;
  end if;

  update public.jhadina_research_execution_leases
     set last_sequence_no=v_seq, spent_cost=n_cost, accrued_risk=n_risk,
         query_count=n_queries, source_count=n_sources, evidence_count=n_evidence,
         retry_count=n_retries, max_depth_seen=n_depth, max_breadth_seen=n_breadth,
         wall_clock_ms=n_wall, updated_at=now()
   where id=p_lease_id;

  insert into public.jhadina_research_execution_events(
    plan_id,lease_id,sequence_no,event_type,task_id,payload,
    expected_budget,actual_usage,result_status,content_hash
  ) values (
    p_plan_id,p_lease_id,v_seq,p_event_type,p_task_id,coalesce(p_payload,'{}'::jsonb),
    v_lease.budget_snapshot,
    jsonb_build_object('cost',n_cost,'risk',n_risk,'queries',n_queries,'sources',n_sources,'evidence',n_evidence,'retries',n_retries,'depth',n_depth,'breadth',n_breadth,'wallClockMs',n_wall),
    'accepted',p_content_hash
  ) returning id into v_event_id;

  if p_event_type='task_completed' then
    select jsonb_array_length(v_plan.tasks) into v_total_tasks;
    select count(*) into v_completed_tasks
    from public.jhadina_research_task_states
    where plan_id=p_plan_id and state in ('completed','abstained');
    if v_total_tasks > 0 and v_completed_tasks >= v_total_tasks then
      update public.jhadina_research_plans set status='completed' where id=p_plan_id;
      update public.jhadina_research_execution_leases set state='completed', released_at=now(), updated_at=now() where id=p_lease_id;
    end if;
  end if;

  return jsonb_build_object('accepted',true,'stopped',false,'eventId',v_event_id,'sequenceNo',v_seq);
end;
$$;

create or replace function public.jhadina_ack_research_provider_submission(
  p_submission_id uuid,
  p_lease_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_provider_job_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_lease public.jhadina_research_execution_leases%rowtype;
  v_row public.jhadina_research_provider_submissions%rowtype;
begin
  select * into v_lease from public.jhadina_research_execution_leases where id=p_lease_id for update;
  if not found or v_lease.state not in ('active','completed') or v_lease.worker_id<>p_worker_id
     or v_lease.lease_token<>p_lease_token or (v_lease.state='active' and v_lease.expires_at<=now()) then return null; end if;

  update public.jhadina_research_provider_submissions
     set status='submitted', provider_job_id=coalesce(p_provider_job_id,provider_job_id), updated_at=now()
   where id=p_submission_id and lease_id=p_lease_id and worker_id=p_worker_id and status='reserved'
  returning * into v_row;
  if not found then
    select * into v_row from public.jhadina_research_provider_submissions where id=p_submission_id and status='submitted';
    if not found then return null; end if;
  end if;
  return jsonb_build_object(
    'id',v_row.id,'planId',v_row.plan_id,'leaseId',v_row.lease_id,'taskId',v_row.task_id,
    'providerId',v_row.provider_id,'idempotencyKey',v_row.idempotency_key,'status',v_row.status,
    'providerJobId',v_row.provider_job_id
  );
end;
$$;

create or replace function public.jhadina_mark_research_provider_recovery(
  p_submission_id uuid,
  p_lease_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_error text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if not exists(
    select 1 from public.jhadina_research_execution_leases
    where id=p_lease_id and worker_id=p_worker_id and lease_token=p_lease_token
  ) then return false; end if;
  update public.jhadina_research_provider_submissions
     set status='recovery_required', last_error=left(coalesce(p_error,'unknown'),2000), updated_at=now()
   where id=p_submission_id and lease_id=p_lease_id and worker_id=p_worker_id and status='reserved';
  return found;
end;
$$;

create or replace function public.jhadina_release_research_execution(
  p_lease_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_state text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_lease public.jhadina_research_execution_leases%rowtype;
  v_decision public.jhadina_research_policy_decisions%rowtype;
begin
  if p_state not in ('released','completed','failed','fenced') then return false; end if;
  select * into v_lease from public.jhadina_research_execution_leases where id=p_lease_id for update;
  if not found or v_lease.worker_id<>p_worker_id or v_lease.lease_token<>p_lease_token then return false; end if;

  if v_lease.state='completed' and p_state in ('completed','released') then return true; end if;
  if p_state='completed' and (v_lease.state<>'active' or v_lease.expires_at<=now()) then return false; end if;
  if v_lease.state not in ('active','expired','fenced') then return false; end if;

  update public.jhadina_research_execution_leases
     set state=p_state, released_at=now(), updated_at=now()
   where id=p_lease_id;

  if p_state in ('completed','failed') then
    select * into v_decision from public.jhadina_research_policy_decisions where id=v_lease.policy_decision_id;
    if found and v_decision.audit_receipt_id is not null then
      update public.jhadina_execution_receipts
         set execution_state=case when p_state='completed' then 'EXECUTED' else 'FAILED' end,
             executed_at=now(), updated_at=now()
       where receipt_id=v_decision.audit_receipt_id
         and execution_state='NOT_EXECUTED';
    end if;
  end if;
  return true;
end;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'jhadina_get_research_runtime_plan',
      'jhadina_claim_research_execution',
      'jhadina_renew_research_execution_lease',
      'jhadina_reserve_research_provider_submission',
      'jhadina_commit_research_execution_event',
      'jhadina_ack_research_provider_submission',
      'jhadina_mark_research_provider_recovery',
      'jhadina_release_research_execution'
    )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end $$;
