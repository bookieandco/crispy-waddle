-- OPP-AUDIT.3–6 — pursuit, outbox, outcome learning, and canonical write hardening.
-- This is intentionally a new migration because the base Opportunity migration
-- was already merged in PR #310 and may already have been applied.

-- OPP-AUDIT.2/3 handoff requirement: append-only observations and
-- non-destructive source ingestion. A fresh source pull may enrich payload
-- evidence but cannot silently regress an in-flight or closed lifecycle.
create table if not exists public.jhadina_opportunity_observations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  source_id text,
  source_name text not null,
  source_url text not null,
  observed_status text not null,
  captured_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create table if not exists public.jhadina_opportunity_reconciliations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  observation_id text not null,
  decision text not null check (decision in ('accept','merge','supersede','quarantine','reject','needs_human_review')),
  preserved_status text not null,
  incoming_status text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade,
  foreign key (user_id, observation_id)
    references public.jhadina_opportunity_observations(user_id, id) on delete cascade
);

create index if not exists jhadina_opportunity_observations_opportunity_idx
  on public.jhadina_opportunity_observations (user_id, opportunity_id, captured_at desc);

create index if not exists jhadina_opportunity_reconciliations_opportunity_idx
  on public.jhadina_opportunity_reconciliations (user_id, opportunity_id, created_at desc);

alter table public.jhadina_opportunity_observations enable row level security;
alter table public.jhadina_opportunity_reconciliations enable row level security;

create policy "jhadina_opportunity_observations_select_own"
  on public.jhadina_opportunity_observations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "jhadina_opportunity_reconciliations_select_own"
  on public.jhadina_opportunity_reconciliations for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.jhadina_opportunity_ingest(
  p_opportunity jsonb,
  p_triage_state text default 'review'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_opportunity->>'id';
  v_existing public.jhadina_opportunities%rowtype;
  v_had_existing boolean := false;
  v_effective_status text;
  v_effective_family text;
  v_effective_type text;
  v_effective_payload jsonb;
  v_observation_id text;
  v_reconciliation_id text;
  v_decision text;
  v_now timestamptz := now();
  v_captured_at timestamptz;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if coalesce(v_id,'') = '' then raise exception 'opportunity id is required'; end if;
  if p_triage_state not in ('review','saved','dismissed') then raise exception 'triage state is invalid'; end if;
  if coalesce(p_opportunity->>'sourceName','') = '' or coalesce(p_opportunity->>'sourceUrl','') = '' then
    raise exception 'opportunity source provenance is required';
  end if;
  if coalesce(p_opportunity->>'status','') <> 'discovered' then
    raise exception 'ingestion may only accept discovered opportunities';
  end if;

  if coalesce(p_opportunity->>'family','') not in (
    'funding','recovery','commerce','employment','business','real_estate','creator','other'
  ) then
    raise exception 'opportunity family is invalid';
  end if;
  if coalesce(p_opportunity->>'type','') not in (
    'grant','contract','prize','tax_credit','rebate','subsidy','loan','investment',
    'accelerator','in_kind','recovery','job','gig','commercial','other'
  ) then
    raise exception 'opportunity type is invalid';
  end if;

  v_captured_at := coalesce(nullif(p_opportunity->>'updatedAt','')::timestamptz, v_now);
  v_observation_id := 'observation:' || v_id || ':' || md5(p_opportunity::text);
  v_reconciliation_id := 'reconciliation:' || v_observation_id;

  select * into v_existing
    from public.jhadina_opportunities
   where user_id = v_user and id = v_id
   for update;
  v_had_existing := found;

  v_effective_family := case when v_had_existing then v_existing.family else p_opportunity->>'family' end;
  v_effective_type := case when v_had_existing then v_existing.opportunity_type else p_opportunity->>'type' end;

  if v_had_existing and v_existing.status <> 'discovered' then
    v_effective_status := v_existing.status;
    v_decision := 'merge';
  else
    v_effective_status := 'discovered';
    v_decision := case
      when v_had_existing then 'merge'
      when coalesce(p_opportunity->>'verificationStatus','unverified') = 'rejected' then 'reject'
      when jsonb_array_length(coalesce(p_opportunity->'evidence','[]'::jsonb)) = 0 then 'quarantine'
      when exists (
        select 1 from jsonb_array_elements(coalesce(p_opportunity->'claims','[]'::jsonb)) claim
         where coalesce((claim->>'verified')::boolean, false) = false
      ) then 'needs_human_review'
      else 'accept'
    end;
  end if;

  if v_had_existing then
    v_effective_payload := v_existing.payload || p_opportunity;
    v_effective_payload := jsonb_set(
      v_effective_payload,
      '{metadata}',
      coalesce(v_existing.payload->'metadata','{}'::jsonb) || coalesce(p_opportunity->'metadata','{}'::jsonb),
      true
    );

    -- Verified evidence survives source refresh even while lifecycle remains discovered.
    if coalesce(v_existing.payload->>'verificationStatus','') = 'verified' then
      v_effective_payload := jsonb_set(v_effective_payload, '{verificationStatus}', '"verified"'::jsonb, true);
      if v_existing.payload->'verificationDecision' is not null then
        v_effective_payload := jsonb_set(
          v_effective_payload,
          '{verificationDecision}',
          v_existing.payload->'verificationDecision',
          true
        );
      end if;
    end if;
  else
    v_effective_payload := p_opportunity;
  end if;

  v_effective_payload := jsonb_set(
    v_effective_payload,
    '{status}',
    to_jsonb(v_effective_status),
    true
  );

  -- Authenticated ingestion cannot create verification truth. A previously
  -- trusted verified decision may survive a source refresh, but new caller-
  -- supplied verification decisions/statuses are stripped here.
  if not (
    v_had_existing
    and coalesce(v_existing.payload->>'verificationStatus','') = 'verified'
  ) then
    v_effective_payload := v_effective_payload - 'verificationDecision';
    v_effective_payload := jsonb_set(
      v_effective_payload,
      '{verificationStatus}',
      '"unverified"'::jsonb,
      true
    );
  end if;

  v_effective_payload := jsonb_set(v_effective_payload, '{id}', to_jsonb(v_id), true);
  v_effective_payload := jsonb_set(v_effective_payload, '{family}', to_jsonb(v_effective_family), true);
  v_effective_payload := jsonb_set(v_effective_payload, '{type}', to_jsonb(v_effective_type), true);

  if v_had_existing and coalesce(v_existing.payload->>'sourceId','') <> '' then
    v_effective_payload := jsonb_set(
      v_effective_payload,
      '{sourceId}',
      v_existing.payload->'sourceId',
      true
    );
  end if;

  if v_had_existing and coalesce(v_existing.payload->'metadata'->>'providerId','') <> '' then
    v_effective_payload := jsonb_set(
      v_effective_payload,
      '{metadata,providerId}',
      v_existing.payload->'metadata'->'providerId',
      true
    );
  end if;

  insert into public.jhadina_opportunities (
    user_id, id, family, opportunity_type, status, source_name, source_url,
    deadline, fit_score, triage_state, approved_at, research_case_id,
    payload, created_at, updated_at
  ) values (
    v_user,
    v_id,
    v_effective_family,
    v_effective_type,
    v_effective_status,
    p_opportunity->>'sourceName',
    p_opportunity->>'sourceUrl',
    nullif(p_opportunity->>'deadline','')::timestamptz,
    nullif(p_opportunity->>'fitScore','')::double precision,
    p_triage_state,
    null,
    null,
    v_effective_payload,
    coalesce(nullif(p_opportunity->>'createdAt','')::timestamptz, v_now),
    v_now
  )
  on conflict (user_id, id) do update
    set family = v_effective_family,
        opportunity_type = v_effective_type,
        status = v_effective_status,
        source_name = excluded.source_name,
        source_url = excluded.source_url,
        deadline = excluded.deadline,
        fit_score = excluded.fit_score,
        payload = v_effective_payload,
        updated_at = v_now;

  insert into public.jhadina_opportunity_observations (
    user_id, id, opportunity_id, source_id, source_name, source_url,
    observed_status, captured_at, payload
  ) values (
    v_user,
    v_observation_id,
    v_id,
    nullif(p_opportunity->>'sourceId',''),
    p_opportunity->>'sourceName',
    p_opportunity->>'sourceUrl',
    coalesce(p_opportunity->>'status','discovered'),
    v_captured_at,
    p_opportunity
  )
  on conflict (user_id, id) do nothing;

  insert into public.jhadina_opportunity_reconciliations (
    user_id, id, opportunity_id, observation_id, decision,
    preserved_status, incoming_status, reason
  ) values (
    v_user,
    v_reconciliation_id,
    v_id,
    v_observation_id,
    v_decision,
    v_effective_status,
    coalesce(p_opportunity->>'status','discovered'),
    case
      when v_had_existing and v_existing.status <> 'discovered'
        then 'Preserved canonical lifecycle while merging fresh source evidence.'
      else 'Canonicalized latest source observation.'
    end
  )
  on conflict (user_id, id) do nothing;

  return jsonb_build_object(
    'userId', v_user,
    'opportunity', v_effective_payload,
    'triageState', coalesce(v_existing.triage_state, p_triage_state),
    'approvedAt', v_existing.approved_at,
    'researchCaseId', v_existing.research_case_id,
    'observationId', v_observation_id,
    'reconciliationDecision', v_decision
  );
end;
$$;

revoke all on function public.jhadina_opportunity_ingest(jsonb, text) from public;
grant execute on function public.jhadina_opportunity_ingest(jsonb, text) to authenticated;

-- OPP-AUDIT.5: durable, idempotent research/pursuit state.
create table if not exists public.jhadina_opportunity_research_cases (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  title text not null,
  status text not null check (status in ('pending','researching','blocked','ready','closed')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id),
  unique (user_id, opportunity_id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create table if not exists public.jhadina_opportunity_research_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  research_case_id text not null,
  kind text not null,
  title text not null,
  required boolean not null default true,
  status text not null check (status in ('pending','in_progress','completed','blocked')),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null,
  completed_at timestamptz,
  primary key (user_id, id),
  unique (user_id, research_case_id, kind),
  foreign key (user_id, research_case_id)
    references public.jhadina_opportunity_research_cases(user_id, id) on delete cascade
);

create table if not exists public.jhadina_opportunity_outbox (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  opportunity_id text not null,
  event_type text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (user_id, event_id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_opportunity_research_cases_status_idx
  on public.jhadina_opportunity_research_cases (user_id, status, updated_at desc);

create index if not exists jhadina_opportunity_research_tasks_case_idx
  on public.jhadina_opportunity_research_tasks (user_id, research_case_id, status);

create index if not exists jhadina_opportunity_outbox_pending_idx
  on public.jhadina_opportunity_outbox (created_at)
  where published_at is null;

alter table public.jhadina_opportunity_research_cases enable row level security;
alter table public.jhadina_opportunity_research_tasks enable row level security;
alter table public.jhadina_opportunity_outbox enable row level security;

create policy "jhadina_opportunity_research_cases_select_own"
  on public.jhadina_opportunity_research_cases for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "jhadina_opportunity_research_tasks_select_own"
  on public.jhadina_opportunity_research_tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "jhadina_opportunity_outbox_select_own"
  on public.jhadina_opportunity_outbox for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.jhadina_opportunity_start_research(
  p_opportunity_id text,
  p_opportunity jsonb,
  p_case jsonb,
  p_tasks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.jhadina_opportunities%rowtype;
  v_task jsonb;
  v_case_id text := p_case->>'id';
  v_now timestamptz := now();
  v_research_opportunity jsonb;
  v_expected_task_kinds text[];
  v_submitted_task_kinds text[];
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;
  if coalesce(p_opportunity->>'id','') <> p_opportunity_id then
    raise exception 'opportunity payload id mismatch';
  end if;
  if coalesce(p_opportunity->>'status','') <> 'research_pending' then
    raise exception 'opportunity payload must enter research_pending';
  end if;
  if coalesce(p_case->>'opportunityId','') <> p_opportunity_id
     or v_case_id <> 'research:' || p_opportunity_id then
    raise exception 'research case does not match canonical opportunity case id';
  end if;
  if jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'research tasks must be an array';
  end if;

  select *
    into v_existing
    from public.jhadina_opportunities
   where user_id = v_user and id = p_opportunity_id
   for update;

  if not found then
    raise exception 'opportunity not found';
  end if;

  if v_existing.status not in ('discovered','research_pending') then
    raise exception 'opportunity is not eligible to start research';
  end if;

  v_expected_task_kinds := array['verify_source','verify_economics','verify_requirements','verify_deadline'];

  if v_existing.family = 'recovery' then
    v_expected_task_kinds := v_expected_task_kinds || array['verify_identity','verify_entitlement','verify_jurisdiction'];
  elsif v_existing.family = 'employment' then
    v_expected_task_kinds := v_expected_task_kinds || array['verify_employer','verify_compensation','assess_capability'];
  elsif v_existing.family = 'funding' then
    v_expected_task_kinds := v_expected_task_kinds || array['assess_capability','assess_competition','assess_compliance'];
  else
    v_expected_task_kinds := v_expected_task_kinds || array['verify_provider','assess_margin','assess_capability','assess_competition','assess_compliance'];
  end if;

  if coalesce((v_existing.payload->'metadata'->>'capabilityGap')::boolean, false) then
    v_expected_task_kinds := v_expected_task_kinds || array['find_partner'];
  end if;

  select array_agg(kind order by kind)
    into v_expected_task_kinds
    from unnest(v_expected_task_kinds) as kind;

  select array_agg(distinct task->>'kind' order by task->>'kind')
    into v_submitted_task_kinds
    from jsonb_array_elements(p_tasks) as task;

  if jsonb_array_length(p_tasks) <> cardinality(v_expected_task_kinds)
     or v_submitted_task_kinds is distinct from v_expected_task_kinds
     or exists (
       select 1
         from jsonb_array_elements(p_tasks) as task
        where coalesce(task->>'id','') = ''
           or coalesce(task->>'title','') = ''
     )
  then
    raise exception 'research task set does not match canonical plan';
  end if;

  -- Lifecycle RPCs derive payloads from persisted canonical truth. The caller
  -- may prove the expected id/status but cannot rewrite provenance/verticals.
  v_research_opportunity := jsonb_set(v_existing.payload, '{status}', '"research_pending"'::jsonb, true);
  v_research_opportunity := jsonb_set(v_research_opportunity, '{updatedAt}', to_jsonb(v_now), true);

  insert into public.jhadina_opportunity_research_cases (
    user_id, id, opportunity_id, title, status, created_at, updated_at
  ) values (
    v_user,
    v_case_id,
    p_opportunity_id,
    p_case->>'title',
    'pending',
    coalesce((p_case->>'createdAt')::timestamptz, v_now),
    coalesce((p_case->>'updatedAt')::timestamptz, v_now)
  )
  on conflict (user_id, opportunity_id) do nothing;

  for v_task in select value from jsonb_array_elements(p_tasks)
  loop
    insert into public.jhadina_opportunity_research_tasks (
      user_id, id, research_case_id, kind, title, required, status,
      evidence_refs, created_at, completed_at
    ) values (
      v_user,
      v_task->>'id',
      v_case_id,
      v_task->>'kind',
      v_task->>'title',
      true,
      'pending',
      '[]'::jsonb,
      coalesce((v_task->>'createdAt')::timestamptz, v_now),
      null
    )
    on conflict (user_id, research_case_id, kind) do nothing;
  end loop;

  update public.jhadina_opportunities
     set status = 'research_pending',
         approved_at = coalesce(approved_at, v_now),
         research_case_id = v_case_id,
         payload = v_research_opportunity,
         updated_at = v_now
   where user_id = v_user and id = p_opportunity_id;

  insert into public.jhadina_opportunity_outbox (
    user_id, event_id, opportunity_id, event_type, payload, created_at
  ) values (
    v_user,
    v_case_id || ':research_started',
    p_opportunity_id,
    'opportunity.research_started',
    jsonb_build_object(
      'opportunityId', p_opportunity_id,
      'researchCaseId', v_case_id,
      'status', 'research_pending'
    ),
    v_now
  )
  on conflict (user_id, event_id) do nothing;

  return jsonb_build_object(
    'userId', v_user,
    'opportunity', v_research_opportunity,
    'triageState', v_existing.triage_state,
    'approvedAt', coalesce(v_existing.approved_at, v_now),
    'researchCaseId', v_case_id
  );
end;
$$;

revoke all on function public.jhadina_opportunity_start_research(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.jhadina_opportunity_start_research(text, jsonb, jsonb, jsonb) to authenticated;


create or replace function public.jhadina_opportunity_update_research_task(
  p_case_id text,
  p_task_id text,
  p_status text,
  p_evidence_refs jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_case public.jhadina_opportunity_research_cases%rowtype;
  v_case_status text;
  v_existing_task_status text;
  v_existing_task_evidence_refs jsonb;
  v_now timestamptz := now();
  v_tasks jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_status not in ('pending','in_progress','completed','blocked') then
    raise exception 'invalid research task status';
  end if;
  if jsonb_typeof(p_evidence_refs) <> 'array' then
    raise exception 'evidence refs must be an array';
  end if;
  if p_status = 'completed' and (
       jsonb_array_length(p_evidence_refs) = 0
       or exists (
         select 1
           from jsonb_array_elements(p_evidence_refs) as evidence_ref
          where jsonb_typeof(evidence_ref) <> 'string'
             or btrim(evidence_ref #>> '{}') = ''
       )
     ) then
    raise exception 'completed research task requires non-empty string evidence refs';
  end if;

  select * into v_case
    from public.jhadina_opportunity_research_cases
   where user_id = v_user and id = p_case_id
   for update;
  if not found then raise exception 'research case not found'; end if;

  select status, evidence_refs into v_existing_task_status, v_existing_task_evidence_refs
    from public.jhadina_opportunity_research_tasks
   where user_id = v_user and research_case_id = p_case_id and id = p_task_id
   for update;
  if not found then raise exception 'research task not found'; end if;
  if v_existing_task_status = 'completed' and p_status <> 'completed' then
    raise exception 'completed research task cannot regress';
  end if;
  if v_existing_task_status = 'completed'
     and p_evidence_refs is distinct from v_existing_task_evidence_refs then
    raise exception 'completed research task evidence cannot be rewritten';
  end if;

  update public.jhadina_opportunity_research_tasks
     set status = p_status,
         evidence_refs = p_evidence_refs,
         completed_at = case when p_status = 'completed' then v_now else null end
   where user_id = v_user and research_case_id = p_case_id and id = p_task_id;

  if exists (
    select 1 from public.jhadina_opportunity_research_tasks
     where user_id = v_user and research_case_id = p_case_id
       and required and status = 'blocked'
  ) then
    v_case_status := 'blocked';
  elsif not exists (
    select 1 from public.jhadina_opportunity_research_tasks
     where user_id = v_user and research_case_id = p_case_id
       and required
       and (status <> 'completed' or jsonb_array_length(evidence_refs) = 0)
  ) then
    v_case_status := 'ready';
  elsif exists (
    select 1 from public.jhadina_opportunity_research_tasks
     where user_id = v_user and research_case_id = p_case_id
       and status in ('in_progress','completed')
  ) then
    v_case_status := 'researching';
  else
    v_case_status := 'pending';
  end if;

  update public.jhadina_opportunity_research_cases
     set status = v_case_status, updated_at = v_now
   where user_id = v_user and id = p_case_id;

  if v_case_status = 'ready' then
    insert into public.jhadina_opportunity_outbox (
      user_id, event_id, opportunity_id, event_type, payload, created_at
    ) values (
      v_user,
      p_case_id || ':research_ready',
      v_case.opportunity_id,
      'opportunity.research_ready',
      jsonb_build_object('opportunityId', v_case.opportunity_id, 'researchCaseId', p_case_id),
      v_now
    )
    on conflict (user_id, event_id) do nothing;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'kind', kind,
    'title', title,
    'required', required,
    'status', status,
    'createdAt', created_at,
    'completedAt', completed_at,
    'evidenceRefs', evidence_refs
  ) order by created_at, id), '[]'::jsonb)
    into v_tasks
    from public.jhadina_opportunity_research_tasks
   where user_id = v_user and research_case_id = p_case_id;

  return jsonb_build_object(
    'id', v_case.id,
    'opportunityId', v_case.opportunity_id,
    'title', v_case.title,
    'status', v_case_status,
    'tasks', v_tasks,
    'createdAt', v_case.created_at,
    'updatedAt', v_now
  );
end;
$$;

create or replace function public.jhadina_opportunity_promote_ready(
  p_opportunity_id text,
  p_case_id text,
  p_opportunity jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.jhadina_opportunities%rowtype;
  v_case_status text;
  v_now timestamptz := now();
  v_ready_opportunity jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if coalesce(p_opportunity->>'id','') <> p_opportunity_id then
    raise exception 'opportunity payload id mismatch';
  end if;
  if coalesce(p_opportunity->>'status','') <> 'ready' then
    raise exception 'opportunity payload must be ready';
  end if;

  select * into v_existing
    from public.jhadina_opportunities
   where user_id = v_user and id = p_opportunity_id
   for update;
  if not found then raise exception 'opportunity not found'; end if;

  select status into v_case_status
    from public.jhadina_opportunity_research_cases
   where user_id = v_user and id = p_case_id and opportunity_id = p_opportunity_id;
  if v_case_status is distinct from 'ready' then
    raise exception 'research case is not ready';
  end if;

  if v_existing.family = 'recovery' then
    raise exception 'recovery ready promotion requires trusted verification service';
  end if;

  v_ready_opportunity := jsonb_set(v_existing.payload, '{status}', '"ready"'::jsonb, true);
  v_ready_opportunity := jsonb_set(v_ready_opportunity, '{updatedAt}', to_jsonb(v_now), true);

  update public.jhadina_opportunities
     set status = 'ready',
         payload = v_ready_opportunity,
         updated_at = v_now
   where user_id = v_user and id = p_opportunity_id;

  insert into public.jhadina_opportunity_outbox (
    user_id, event_id, opportunity_id, event_type, payload, created_at
  ) values (
    v_user,
    p_case_id || ':opportunity_ready',
    p_opportunity_id,
    'opportunity.ready',
    jsonb_build_object('opportunityId', p_opportunity_id, 'researchCaseId', p_case_id),
    v_now
  )
  on conflict (user_id, event_id) do nothing;

  return jsonb_build_object(
    'userId', v_user,
    'opportunity', v_ready_opportunity,
    'triageState', v_existing.triage_state,
    'approvedAt', v_existing.approved_at,
    'researchCaseId', p_case_id
  );
end;
$$;

revoke all on function public.jhadina_opportunity_update_research_task(text, text, text, jsonb) from public;
revoke all on function public.jhadina_opportunity_promote_ready(text, text, jsonb) from public;
grant execute on function public.jhadina_opportunity_update_research_task(text, text, text, jsonb) to authenticated;
grant execute on function public.jhadina_opportunity_promote_ready(text, text, jsonb) to authenticated;


-- OPP-AUDIT.6: evidence-backed realized outcomes and learning lineage.
create table if not exists public.jhadina_opportunity_outcomes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  result text not null check (result in ('won','lost')),
  currency text not null,
  gross_revenue double precision not null,
  refunds double precision not null,
  direct_costs double precision not null,
  fees double precision not null,
  net_revenue double precision not null,
  total_costs double precision not null,
  profit double precision not null,
  margin double precision,
  hours double precision not null,
  dollars_per_hour double precision,
  source_owner text not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array'),
  transaction_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(transaction_refs) = 'array'),
  action_ref text,
  execution_ref text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_opportunity_outcomes_opportunity_idx
  on public.jhadina_opportunity_outcomes (user_id, opportunity_id, observed_at desc);

alter table public.jhadina_opportunity_outcomes enable row level security;

create policy "jhadina_opportunity_outcomes_select_own"
  on public.jhadina_opportunity_outcomes for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.jhadina_opportunity_record_outcome(
  p_opportunity_id text,
  p_opportunity jsonb,
  p_outcome jsonb,
  p_learning jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.jhadina_opportunities%rowtype;
  v_outcome_id text := p_outcome->>'id';
  v_now timestamptz := now();
  v_expected_margin double precision;
  v_expected_dollars_per_hour double precision;
  v_learning jsonb;
  v_closed_opportunity jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if coalesce(p_opportunity->>'id','') <> p_opportunity_id then
    raise exception 'opportunity payload id mismatch';
  end if;
  if coalesce(p_outcome->>'opportunityId','') <> p_opportunity_id then
    raise exception 'outcome does not match opportunity';
  end if;
  if coalesce(v_outcome_id,'') = '' then raise exception 'outcome id is required'; end if;
  if coalesce(p_outcome->>'result','') not in ('won','lost') then raise exception 'outcome result is invalid'; end if;
  -- This RPC is executable by authenticated users. Trusted subsystem labels
  -- require a separate service-role ingestion path and cannot be self-asserted.
  if coalesce(p_outcome->>'sourceOwner','') <> 'user' then
    raise exception 'authenticated outcome RPC only accepts user-reported source ownership';
  end if;
  if coalesce(p_opportunity->>'status','') <> p_outcome->>'result' then
    raise exception 'opportunity status must match outcome result';
  end if;
  if jsonb_typeof(p_outcome->'evidenceRefs') <> 'array'
     or jsonb_array_length(p_outcome->'evidenceRefs') = 0 then
    raise exception 'outcome requires evidence';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_outcome->'evidenceRefs') as evidence_ref
     where jsonb_typeof(evidence_ref) <> 'string'
        or btrim(evidence_ref #>> '{}') = ''
  ) then
    raise exception 'outcome evidenceRefs must contain non-empty strings';
  end if;

  if coalesce(p_outcome->>'currency','') = '' or coalesce(p_outcome->>'observedAt','') = '' then
    raise exception 'outcome currency and observedAt are required';
  end if;
  if not (
    p_outcome ? 'grossRevenue' and p_outcome ? 'refunds'
    and p_outcome ? 'directCosts' and p_outcome ? 'fees'
    and p_outcome ? 'netRevenue' and p_outcome ? 'totalCosts'
    and p_outcome ? 'profit' and p_outcome ? 'hours'
  ) then
    raise exception 'outcome required financial fields are missing';
  end if;
  if (p_outcome->>'grossRevenue')::double precision < 0
     or (p_outcome->>'refunds')::double precision < 0
     or (p_outcome->>'directCosts')::double precision < 0
     or (p_outcome->>'fees')::double precision < 0
     or (p_outcome->>'hours')::double precision < 0 then
    raise exception 'outcome input financial fields must be non-negative';
  end if;
  if p_outcome ? 'transactionRefs'
     and (
       coalesce(jsonb_typeof(p_outcome->'transactionRefs'),'null') <> 'array'
       or exists (
         select 1
           from jsonb_array_elements(
             case
               when jsonb_typeof(p_outcome->'transactionRefs') = 'array' then p_outcome->'transactionRefs'
               else '[]'::jsonb
             end
           ) as transaction_ref
          where jsonb_typeof(transaction_ref) <> 'string'
             or btrim(transaction_ref #>> '{}') = ''
       )
     ) then
    raise exception 'outcome transactionRefs must be an array of non-empty strings';
  end if;
  if abs(
       (p_outcome->>'netRevenue')::double precision
       - ((p_outcome->>'grossRevenue')::double precision - (p_outcome->>'refunds')::double precision)
     ) > 0.000001
     or abs(
       (p_outcome->>'totalCosts')::double precision
       - ((p_outcome->>'directCosts')::double precision + (p_outcome->>'fees')::double precision)
     ) > 0.000001
     or abs(
       (p_outcome->>'profit')::double precision
       - (
         ((p_outcome->>'grossRevenue')::double precision - (p_outcome->>'refunds')::double precision)
         - ((p_outcome->>'directCosts')::double precision + (p_outcome->>'fees')::double precision)
       )
     ) > 0.000001
  then
    raise exception 'outcome derived financial fields do not reconcile';
  end if;

  v_expected_margin := case
    when (p_outcome->>'netRevenue')::double precision > 0
      then (p_outcome->>'profit')::double precision / (p_outcome->>'netRevenue')::double precision
    else null
  end;
  v_expected_dollars_per_hour := case
    when (p_outcome->>'hours')::double precision > 0
      then (p_outcome->>'profit')::double precision / (p_outcome->>'hours')::double precision
    else null
  end;

  if (
       v_expected_margin is null and p_outcome->>'margin' is not null
     ) or (
       v_expected_margin is not null
       and (
         p_outcome->>'margin' is null
         or abs((p_outcome->>'margin')::double precision - v_expected_margin) > 0.000001
       )
     ) or (
       v_expected_dollars_per_hour is null and p_outcome->>'dollarsPerHour' is not null
     ) or (
       v_expected_dollars_per_hour is not null
       and (
         p_outcome->>'dollarsPerHour' is null
         or abs((p_outcome->>'dollarsPerHour')::double precision - v_expected_dollars_per_hour) > 0.000001
       )
     )
  then
    raise exception 'outcome margin or dollarsPerHour does not reconcile';
  end if;

  select * into v_existing
    from public.jhadina_opportunities
   where user_id = v_user and id = p_opportunity_id
   for update;
  if not found then raise exception 'opportunity not found'; end if;

  if v_existing.status not in ('ready','pursuing','won','lost') then
    raise exception 'opportunity is not eligible for realized outcome';
  end if;
  if v_existing.status in ('won','lost') and v_existing.status <> p_outcome->>'result' then
    raise exception 'closed opportunity result cannot be reversed';
  end if;

  -- Caller-supplied p_learning is intentionally ignored. Learning truth is
  -- derived from the stored Opportunity identity plus the validated receipt.
  v_learning := jsonb_build_object(
    'id', 'learning:' || v_outcome_id,
    'opportunityId', p_opportunity_id,
    'family', v_existing.family,
    'type', v_existing.type,
    'result', p_outcome->>'result',
    'currency', p_outcome->>'currency',
    'grossRevenue', p_outcome->'grossRevenue',
    'netRevenue', p_outcome->'netRevenue',
    'totalCosts', p_outcome->'totalCosts',
    'profit', p_outcome->'profit',
    'margin', p_outcome->'margin',
    'hours', p_outcome->'hours',
    'dollarsPerHour', p_outcome->'dollarsPerHour',
    'sourceOwner', p_outcome->>'sourceOwner',
    'evidenceRefs', p_outcome->'evidenceRefs',
    'transactionRefs', coalesce(p_outcome->'transactionRefs','[]'::jsonb),
    'observedAt', p_outcome->>'observedAt'
  ) || case
    when coalesce(v_existing.payload->'metadata'->>'providerId','') <> ''
      then jsonb_build_object('providerId', v_existing.payload->'metadata'->>'providerId')
    else '{}'::jsonb
  end;

  -- Caller-supplied p_opportunity proves expected id/result only; it is never
  -- trusted to overwrite canonical identity, provenance, or vertical fields.
  v_closed_opportunity := jsonb_set(
    v_existing.payload,
    '{metadata}',
    coalesce(v_existing.payload->'metadata','{}'::jsonb) || jsonb_build_object(
      'lastOutcomeId', v_outcome_id,
      'realizedProfit', p_outcome->'profit',
      'realizedMargin', p_outcome->'margin',
      'realizedDollarsPerHour', p_outcome->'dollarsPerHour'
    ),
    true
  );
  v_closed_opportunity := jsonb_set(v_closed_opportunity, '{status}', to_jsonb(p_outcome->>'result'), true);
  v_closed_opportunity := jsonb_set(v_closed_opportunity, '{updatedAt}', to_jsonb(v_now), true);

  if exists (
    select 1
      from public.jhadina_opportunity_outcomes
     where user_id = v_user and id = v_outcome_id and payload <> p_outcome
  ) then
    raise exception 'outcome id already exists with different payload';
  end if;

  insert into public.jhadina_opportunity_outcomes (
    user_id, id, opportunity_id, result, currency, gross_revenue, refunds,
    direct_costs, fees, net_revenue, total_costs, profit, margin, hours,
    dollars_per_hour, source_owner, evidence_refs, transaction_refs,
    action_ref, execution_ref, payload, observed_at, created_at
  ) values (
    v_user,
    v_outcome_id,
    p_opportunity_id,
    p_outcome->>'result',
    p_outcome->>'currency',
    (p_outcome->>'grossRevenue')::double precision,
    (p_outcome->>'refunds')::double precision,
    (p_outcome->>'directCosts')::double precision,
    (p_outcome->>'fees')::double precision,
    (p_outcome->>'netRevenue')::double precision,
    (p_outcome->>'totalCosts')::double precision,
    (p_outcome->>'profit')::double precision,
    nullif(p_outcome->>'margin','')::double precision,
    (p_outcome->>'hours')::double precision,
    nullif(p_outcome->>'dollarsPerHour','')::double precision,
    p_outcome->>'sourceOwner',
    p_outcome->'evidenceRefs',
    coalesce(p_outcome->'transactionRefs','[]'::jsonb),
    nullif(p_outcome->>'actionRef',''),
    nullif(p_outcome->>'executionRef',''),
    p_outcome,
    (p_outcome->>'observedAt')::timestamptz,
    v_now
  )
  on conflict (user_id, id) do nothing;

  update public.jhadina_opportunities
     set status = p_outcome->>'result',
         payload = v_closed_opportunity,
         updated_at = v_now
   where user_id = v_user and id = p_opportunity_id;

  insert into public.jhadina_opportunity_outbox (
    user_id, event_id, opportunity_id, event_type, payload, created_at
  ) values (
    v_user,
    v_outcome_id || ':recorded',
    p_opportunity_id,
    'opportunity.outcome_recorded',
    jsonb_build_object(
      'opportunityId', p_opportunity_id,
      'outcome', p_outcome,
      'learningSignal', v_learning
    ),
    v_now
  )
  on conflict (user_id, event_id) do nothing;

  return jsonb_build_object(
    'userId', v_user,
    'opportunity', v_closed_opportunity,
    'triageState', v_existing.triage_state,
    'approvedAt', v_existing.approved_at,
    'researchCaseId', v_existing.research_case_id,
    'outcome', p_outcome,
    'learningSignal', v_learning
  );
end;
$$;

revoke all on function public.jhadina_opportunity_record_outcome(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.jhadina_opportunity_record_outcome(text, jsonb, jsonb, jsonb) to authenticated;


-- OPP-AUDIT.2/5: canonical writes must go through narrow authenticated RPCs.
create or replace function public.jhadina_opportunity_set_triage(
  p_opportunity_id text,
  p_triage_state text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_opportunities%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_triage_state not in ('review','saved','dismissed') then
    raise exception 'invalid triage state';
  end if;

  update public.jhadina_opportunities
     set triage_state = p_triage_state,
         updated_at = now()
   where user_id = v_user and id = p_opportunity_id
   returning * into v_row;

  if not found then raise exception 'opportunity not found'; end if;

  return jsonb_build_object(
    'userId', v_row.user_id,
    'opportunity', v_row.payload,
    'triageState', v_row.triage_state,
    'approvedAt', v_row.approved_at,
    'researchCaseId', v_row.research_case_id
  );
end;
$$;

drop policy if exists "jhadina_opportunities_insert_own" on public.jhadina_opportunities;
drop policy if exists "jhadina_opportunities_update_own" on public.jhadina_opportunities;
drop policy if exists "jhadina_opportunities_delete_own" on public.jhadina_opportunities;

revoke insert, update, delete on public.jhadina_opportunities from authenticated;
revoke insert, update, delete on public.jhadina_opportunity_observations from authenticated;
revoke insert, update, delete on public.jhadina_opportunity_reconciliations from authenticated;
revoke insert, update, delete on public.jhadina_opportunity_research_cases from authenticated;
revoke insert, update, delete on public.jhadina_opportunity_research_tasks from authenticated;
revoke insert, update, delete on public.jhadina_opportunity_outbox from authenticated;
revoke insert, update, delete on public.jhadina_opportunity_outcomes from authenticated;

grant select on public.jhadina_opportunities to authenticated;
grant select on public.jhadina_opportunity_observations to authenticated;
grant select on public.jhadina_opportunity_reconciliations to authenticated;
grant select on public.jhadina_opportunity_research_cases to authenticated;
grant select on public.jhadina_opportunity_research_tasks to authenticated;
grant select on public.jhadina_opportunity_outbox to authenticated;
grant select on public.jhadina_opportunity_outcomes to authenticated;

revoke all on function public.jhadina_opportunity_set_triage(text, text) from public;
grant execute on function public.jhadina_opportunity_set_triage(text, text) to authenticated;


-- Trusted recovery verification path. OverageOS/verification workers may call
-- this with the service-role client after producing an evidence-backed
-- VerificationDecision. Ordinary authenticated users cannot invoke it.
create or replace function public.jhadina_opportunity_promote_recovery_ready_trusted(
  p_user_id uuid,
  p_opportunity_id text,
  p_case_id text,
  p_opportunity jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.jhadina_opportunities%rowtype;
  v_case_status text;
  v_now timestamptz := now();
  v_ready_opportunity jsonb;
begin
  if coalesce(p_opportunity->>'id','') <> p_opportunity_id then raise exception 'opportunity payload id mismatch'; end if;
  if coalesce(p_opportunity->>'status','') <> 'ready' then raise exception 'opportunity payload must be ready'; end if;

  select * into v_existing
    from public.jhadina_opportunities
   where user_id = p_user_id and id = p_opportunity_id
   for update;
  if not found then raise exception 'opportunity not found'; end if;
  if v_existing.family <> 'recovery' then raise exception 'trusted recovery promotion only accepts recovery opportunities'; end if;

  select status into v_case_status
    from public.jhadina_opportunity_research_cases
   where user_id = p_user_id and id = p_case_id and opportunity_id = p_opportunity_id;
  if v_case_status is distinct from 'ready' then raise exception 'research case is not ready'; end if;

  if coalesce(p_opportunity->>'verificationStatus','') <> 'verified'
     or p_opportunity->'verificationDecision' is null
     or coalesce(p_opportunity->'verificationDecision'->>'opportunityId','') <> p_opportunity_id
     or coalesce(p_opportunity->'verificationDecision'->>'status','') <> 'verified'
     or coalesce(p_opportunity->'verificationDecision'->>'reviewerRef','') = ''
     or coalesce(p_opportunity->'verificationDecision'->>'verifiedAt','') = ''
     or coalesce(jsonb_typeof(p_opportunity->'verificationDecision'->'evidenceRefs'),'null') <> 'array'
     or jsonb_array_length(p_opportunity->'verificationDecision'->'evidenceRefs') = 0
     or coalesce(jsonb_typeof(p_opportunity->'verificationDecision'->'checks'),'null') <> 'array'
     or exists (
       select 1
         from (values ('source_record'),('property_reference'),('claimant_identity'),('entitlement')) as required(check_type)
        where not exists (
          select 1
            from jsonb_array_elements(p_opportunity->'verificationDecision'->'checks') as check_row
           where check_row->>'type' = required.check_type
             and check_row->>'result' = 'verified'
             and coalesce(jsonb_typeof(check_row->'evidenceRefs'),'null') = 'array'
             and jsonb_array_length(check_row->'evidenceRefs') > 0
        )
     )
  then
    raise exception 'recovery verification is incomplete';
  end if;

  if exists (
       select 1
         from jsonb_array_elements(p_opportunity->'verificationDecision'->'evidenceRefs') as evidence_ref
        where jsonb_typeof(evidence_ref) <> 'string'
           or btrim(evidence_ref #>> '{}') = ''
     )
     or exists (
       select 1
         from jsonb_array_elements(p_opportunity->'verificationDecision'->'checks') as check_row
        where exists (
          select 1
            from jsonb_array_elements(
              case
                when jsonb_typeof(check_row->'evidenceRefs') = 'array' then check_row->'evidenceRefs'
                else '[]'::jsonb
              end
            ) as evidence_ref
           where jsonb_typeof(evidence_ref) <> 'string'
              or btrim(evidence_ref #>> '{}') = ''
        )
     )
  then
    raise exception 'recovery verification evidence refs are invalid';
  end if;

  -- Trusted recovery may add verification truth, but it still cannot replace
  -- canonical identity/provenance/vertical fields from the persisted row.
  v_ready_opportunity := jsonb_set(v_existing.payload, '{verificationStatus}', '"verified"'::jsonb, true);
  v_ready_opportunity := jsonb_set(v_ready_opportunity, '{verificationDecision}', p_opportunity->'verificationDecision', true);
  v_ready_opportunity := jsonb_set(v_ready_opportunity, '{status}', '"ready"'::jsonb, true);
  v_ready_opportunity := jsonb_set(v_ready_opportunity, '{updatedAt}', to_jsonb(v_now), true);

  update public.jhadina_opportunities
     set status = 'ready', payload = v_ready_opportunity, updated_at = v_now
   where user_id = p_user_id and id = p_opportunity_id;

  insert into public.jhadina_opportunity_outbox (
    user_id, event_id, opportunity_id, event_type, payload, created_at
  ) values (
    p_user_id,
    p_case_id || ':opportunity_ready',
    p_opportunity_id,
    'opportunity.ready',
    jsonb_build_object('opportunityId', p_opportunity_id, 'researchCaseId', p_case_id, 'trustedRecoveryVerification', true),
    v_now
  )
  on conflict (user_id, event_id) do nothing;

  return jsonb_build_object(
    'userId', p_user_id,
    'opportunity', v_ready_opportunity,
    'triageState', v_existing.triage_state,
    'approvedAt', v_existing.approved_at,
    'researchCaseId', p_case_id
  );
end;
$$;

revoke all on function public.jhadina_opportunity_promote_recovery_ready_trusted(uuid, text, text, jsonb) from public;
grant execute on function public.jhadina_opportunity_promote_recovery_ready_trusted(uuid, text, text, jsonb) to service_role;

-- Trusted financial/commerce/placement/recovery outcome path. This is
-- intentionally separate from the authenticated user-reported outcome RPC.
create or replace function public.jhadina_opportunity_record_trusted_outcome(
  p_user_id uuid,
  p_opportunity_id text,
  p_opportunity jsonb,
  p_outcome jsonb,
  p_learning jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.jhadina_opportunities%rowtype;
  v_outcome_id text := p_outcome->>'id';
  v_now timestamptz := now();
  v_expected_margin double precision;
  v_expected_dollars_per_hour double precision;
  v_learning jsonb;
  v_closed_opportunity jsonb;
begin
  if coalesce(p_opportunity->>'id','') <> p_opportunity_id then raise exception 'opportunity payload id mismatch'; end if;
  if coalesce(p_outcome->>'opportunityId','') <> p_opportunity_id then raise exception 'outcome does not match opportunity'; end if;
  if coalesce(v_outcome_id,'') = '' then raise exception 'outcome id is required'; end if;
  if coalesce(p_outcome->>'result','') not in ('won','lost') then raise exception 'outcome result is invalid'; end if;
  if coalesce(p_outcome->>'sourceOwner','') not in ('money_core','commerce','placement','overageos') then
    raise exception 'trusted outcome source owner is invalid';
  end if;
  if coalesce(p_opportunity->>'status','') <> p_outcome->>'result' then raise exception 'opportunity status must match outcome result'; end if;
  if coalesce(jsonb_typeof(p_outcome->'evidenceRefs'),'null') <> 'array'
     or jsonb_array_length(p_outcome->'evidenceRefs') = 0 then
    raise exception 'outcome requires evidence';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_outcome->'evidenceRefs') as evidence_ref
     where jsonb_typeof(evidence_ref) <> 'string'
        or btrim(evidence_ref #>> '{}') = ''
  ) then
    raise exception 'outcome evidenceRefs must contain non-empty strings';
  end if;

  if coalesce(p_outcome->>'currency','') = '' or coalesce(p_outcome->>'observedAt','') = '' then
    raise exception 'outcome currency and observedAt are required';
  end if;
  if not (
    p_outcome ? 'grossRevenue' and p_outcome ? 'refunds'
    and p_outcome ? 'directCosts' and p_outcome ? 'fees'
    and p_outcome ? 'netRevenue' and p_outcome ? 'totalCosts'
    and p_outcome ? 'profit' and p_outcome ? 'hours'
  ) then
    raise exception 'outcome required financial fields are missing';
  end if;
  if (p_outcome->>'grossRevenue')::double precision < 0
     or (p_outcome->>'refunds')::double precision < 0
     or (p_outcome->>'directCosts')::double precision < 0
     or (p_outcome->>'fees')::double precision < 0
     or (p_outcome->>'hours')::double precision < 0 then
    raise exception 'outcome input financial fields must be non-negative';
  end if;
  if p_outcome ? 'transactionRefs'
     and (
       coalesce(jsonb_typeof(p_outcome->'transactionRefs'),'null') <> 'array'
       or exists (
         select 1
           from jsonb_array_elements(
             case
               when jsonb_typeof(p_outcome->'transactionRefs') = 'array' then p_outcome->'transactionRefs'
               else '[]'::jsonb
             end
           ) as transaction_ref
          where jsonb_typeof(transaction_ref) <> 'string'
             or btrim(transaction_ref #>> '{}') = ''
       )
     ) then
    raise exception 'outcome transactionRefs must be an array of non-empty strings';
  end if;

  select * into v_existing
    from public.jhadina_opportunities
   where user_id = p_user_id and id = p_opportunity_id
   for update;
  if not found then raise exception 'opportunity not found'; end if;
  if v_existing.status not in ('ready','pursuing','won','lost') then
    raise exception 'opportunity is not eligible for realized outcome';
  end if;
  if v_existing.status in ('won','lost') and v_existing.status <> p_outcome->>'result' then
    raise exception 'closed opportunity result cannot be reversed';
  end if;

  -- Caller-supplied p_learning is intentionally ignored. Learning truth is
  -- derived from the stored Opportunity identity plus the validated receipt.
  v_learning := jsonb_build_object(
    'id', 'learning:' || v_outcome_id,
    'opportunityId', p_opportunity_id,
    'family', v_existing.family,
    'type', v_existing.type,
    'result', p_outcome->>'result',
    'currency', p_outcome->>'currency',
    'grossRevenue', p_outcome->'grossRevenue',
    'netRevenue', p_outcome->'netRevenue',
    'totalCosts', p_outcome->'totalCosts',
    'profit', p_outcome->'profit',
    'margin', p_outcome->'margin',
    'hours', p_outcome->'hours',
    'dollarsPerHour', p_outcome->'dollarsPerHour',
    'sourceOwner', p_outcome->>'sourceOwner',
    'evidenceRefs', p_outcome->'evidenceRefs',
    'transactionRefs', coalesce(p_outcome->'transactionRefs','[]'::jsonb),
    'observedAt', p_outcome->>'observedAt'
  ) || case
    when coalesce(v_existing.payload->'metadata'->>'providerId','') <> ''
      then jsonb_build_object('providerId', v_existing.payload->'metadata'->>'providerId')
    else '{}'::jsonb
  end;

  -- Caller-supplied p_opportunity proves expected id/result only; it is never
  -- trusted to overwrite canonical identity, provenance, or vertical fields.
  v_closed_opportunity := jsonb_set(
    v_existing.payload,
    '{metadata}',
    coalesce(v_existing.payload->'metadata','{}'::jsonb) || jsonb_build_object(
      'lastOutcomeId', v_outcome_id,
      'realizedProfit', p_outcome->'profit',
      'realizedMargin', p_outcome->'margin',
      'realizedDollarsPerHour', p_outcome->'dollarsPerHour'
    ),
    true
  );
  v_closed_opportunity := jsonb_set(v_closed_opportunity, '{status}', to_jsonb(p_outcome->>'result'), true);
  v_closed_opportunity := jsonb_set(v_closed_opportunity, '{updatedAt}', to_jsonb(v_now), true);

  if abs((p_outcome->>'netRevenue')::double precision - ((p_outcome->>'grossRevenue')::double precision - (p_outcome->>'refunds')::double precision)) > 0.000001
     or abs((p_outcome->>'totalCosts')::double precision - ((p_outcome->>'directCosts')::double precision + (p_outcome->>'fees')::double precision)) > 0.000001
     or abs((p_outcome->>'profit')::double precision - (((p_outcome->>'grossRevenue')::double precision - (p_outcome->>'refunds')::double precision) - ((p_outcome->>'directCosts')::double precision + (p_outcome->>'fees')::double precision))) > 0.000001
  then
    raise exception 'outcome derived financial fields do not reconcile';
  end if;

  v_expected_margin := case
    when (p_outcome->>'netRevenue')::double precision > 0
      then (p_outcome->>'profit')::double precision / (p_outcome->>'netRevenue')::double precision
    else null
  end;
  v_expected_dollars_per_hour := case
    when (p_outcome->>'hours')::double precision > 0
      then (p_outcome->>'profit')::double precision / (p_outcome->>'hours')::double precision
    else null
  end;

  if (
       v_expected_margin is null and p_outcome->>'margin' is not null
     ) or (
       v_expected_margin is not null
       and (
         p_outcome->>'margin' is null
         or abs((p_outcome->>'margin')::double precision - v_expected_margin) > 0.000001
       )
     ) or (
       v_expected_dollars_per_hour is null and p_outcome->>'dollarsPerHour' is not null
     ) or (
       v_expected_dollars_per_hour is not null
       and (
         p_outcome->>'dollarsPerHour' is null
         or abs((p_outcome->>'dollarsPerHour')::double precision - v_expected_dollars_per_hour) > 0.000001
       )
     )
  then
    raise exception 'outcome margin or dollarsPerHour does not reconcile';
  end if;

  if exists (
    select 1 from public.jhadina_opportunity_outcomes
     where user_id = p_user_id and id = v_outcome_id and payload <> p_outcome
  ) then
    raise exception 'outcome id already exists with different payload';
  end if;

  insert into public.jhadina_opportunity_outcomes (
    user_id, id, opportunity_id, result, currency, gross_revenue, refunds,
    direct_costs, fees, net_revenue, total_costs, profit, margin, hours,
    dollars_per_hour, source_owner, evidence_refs, transaction_refs,
    action_ref, execution_ref, payload, observed_at, created_at
  ) values (
    p_user_id, v_outcome_id, p_opportunity_id, p_outcome->>'result', p_outcome->>'currency',
    (p_outcome->>'grossRevenue')::double precision, (p_outcome->>'refunds')::double precision,
    (p_outcome->>'directCosts')::double precision, (p_outcome->>'fees')::double precision,
    (p_outcome->>'netRevenue')::double precision, (p_outcome->>'totalCosts')::double precision,
    (p_outcome->>'profit')::double precision, nullif(p_outcome->>'margin','')::double precision,
    (p_outcome->>'hours')::double precision, nullif(p_outcome->>'dollarsPerHour','')::double precision,
    p_outcome->>'sourceOwner', p_outcome->'evidenceRefs', coalesce(p_outcome->'transactionRefs','[]'::jsonb),
    nullif(p_outcome->>'actionRef',''), nullif(p_outcome->>'executionRef',''),
    p_outcome, (p_outcome->>'observedAt')::timestamptz, v_now
  )
  on conflict (user_id, id) do nothing;

  update public.jhadina_opportunities
     set status = p_outcome->>'result',
         payload = v_closed_opportunity,
         updated_at = v_now
   where user_id = p_user_id and id = p_opportunity_id;

  insert into public.jhadina_opportunity_outbox (
    user_id, event_id, opportunity_id, event_type, payload, created_at
  ) values (
    p_user_id, v_outcome_id || ':recorded', p_opportunity_id, 'opportunity.outcome_recorded',
    jsonb_build_object('opportunityId', p_opportunity_id, 'outcome', p_outcome, 'learningSignal', v_learning),
    v_now
  )
  on conflict (user_id, event_id) do nothing;

  return jsonb_build_object(
    'userId', p_user_id,
    'opportunity', v_closed_opportunity,
    'triageState', v_existing.triage_state,
    'approvedAt', v_existing.approved_at,
    'researchCaseId', v_existing.research_case_id,
    'outcome', p_outcome,
    'learningSignal', v_learning
  );
end;
$$;

revoke all on function public.jhadina_opportunity_record_trusted_outcome(uuid, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.jhadina_opportunity_record_trusted_outcome(uuid, text, jsonb, jsonb, jsonb) to service_role;


-- OPP-AUDIT production privilege normalization.
-- Older projects may auto-grant Data API privileges to anon/authenticated on
-- newly-created public tables/functions. Normalize to the intended least-
-- privilege surface after every object exists.

revoke all on table public.jhadina_opportunities from anon;
revoke all on table public.jhadina_opportunity_observations from anon;
revoke all on table public.jhadina_opportunity_reconciliations from anon;
revoke all on table public.jhadina_opportunity_research_cases from anon;
revoke all on table public.jhadina_opportunity_research_tasks from anon;
revoke all on table public.jhadina_opportunity_outbox from anon;
revoke all on table public.jhadina_opportunity_outcomes from anon;

revoke all on table public.jhadina_opportunities from authenticated;
revoke all on table public.jhadina_opportunity_observations from authenticated;
revoke all on table public.jhadina_opportunity_reconciliations from authenticated;
revoke all on table public.jhadina_opportunity_research_cases from authenticated;
revoke all on table public.jhadina_opportunity_research_tasks from authenticated;
revoke all on table public.jhadina_opportunity_outbox from authenticated;
revoke all on table public.jhadina_opportunity_outcomes from authenticated;

grant select on table public.jhadina_opportunities to authenticated;
grant select on table public.jhadina_opportunity_observations to authenticated;
grant select on table public.jhadina_opportunity_reconciliations to authenticated;
grant select on table public.jhadina_opportunity_research_cases to authenticated;
grant select on table public.jhadina_opportunity_research_tasks to authenticated;
grant select on table public.jhadina_opportunity_outbox to authenticated;
grant select on table public.jhadina_opportunity_outcomes to authenticated;

grant all on table public.jhadina_opportunities to service_role;
grant all on table public.jhadina_opportunity_observations to service_role;
grant all on table public.jhadina_opportunity_reconciliations to service_role;
grant all on table public.jhadina_opportunity_research_cases to service_role;
grant all on table public.jhadina_opportunity_research_tasks to service_role;
grant all on table public.jhadina_opportunity_outbox to service_role;
grant all on table public.jhadina_opportunity_outcomes to service_role;

revoke all on function public.jhadina_opportunity_ingest(jsonb, text) from anon;
revoke all on function public.jhadina_opportunity_start_research(text, jsonb, jsonb, jsonb) from anon;
revoke all on function public.jhadina_opportunity_update_research_task(text, text, text, jsonb) from anon;
revoke all on function public.jhadina_opportunity_promote_ready(text, text, jsonb) from anon;
revoke all on function public.jhadina_opportunity_record_outcome(text, jsonb, jsonb, jsonb) from anon;
revoke all on function public.jhadina_opportunity_set_triage(text, text) from anon;
revoke all on function public.jhadina_opportunity_promote_recovery_ready_trusted(uuid, text, text, jsonb) from anon, authenticated;
revoke all on function public.jhadina_opportunity_record_trusted_outcome(uuid, text, jsonb, jsonb, jsonb) from anon, authenticated;

grant execute on function public.jhadina_opportunity_ingest(jsonb, text) to authenticated;
grant execute on function public.jhadina_opportunity_start_research(text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.jhadina_opportunity_update_research_task(text, text, text, jsonb) to authenticated;
grant execute on function public.jhadina_opportunity_promote_ready(text, text, jsonb) to authenticated;
grant execute on function public.jhadina_opportunity_record_outcome(text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.jhadina_opportunity_set_triage(text, text) to authenticated;
grant execute on function public.jhadina_opportunity_promote_recovery_ready_trusted(uuid, text, text, jsonb) to service_role;
grant execute on function public.jhadina_opportunity_record_trusted_outcome(uuid, text, jsonb, jsonb, jsonb) to service_role;
