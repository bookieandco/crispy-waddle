-- VENTURE-RESEARCH.AUTO
-- Explicit standing owner policy may authorize creation of canonical research cases.
-- This does not authorize experiments, outreach, publishing, purchasing, launch, or money movement.

alter table public.jhadina_venture_discovery_policies
  add column if not exists auto_start_research boolean not null default false;

create index if not exists jhadina_venture_discovery_policies_research_idx
  on public.jhadina_venture_discovery_policies(enabled, auto_start_research, updated_at desc);

create or replace function public.jhadina_venture_candidate_start_research(
  p_owner_user_id uuid,
  p_candidate_id text,
  p_opportunity_id text,
  p_case jsonb,
  p_tasks jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_policy public.jhadina_venture_discovery_policies%rowtype;
  v_candidate public.jhadina_venture_candidate_inbox%rowtype;
  v_adoption public.jhadina_venture_candidate_adoptions%rowtype;
  v_existing public.jhadina_opportunities%rowtype;
  v_task jsonb;
  v_case_id text := p_case->>'id';
  v_now timestamptz := now();
  v_research_opportunity jsonb;
  v_expected_task_kinds text[];
  v_submitted_task_kinds text[];
begin
  if p_owner_user_id is null then raise exception 'owner user id is required'; end if;
  if coalesce(p_candidate_id,'') = '' then raise exception 'candidate id is required'; end if;
  if coalesce(p_opportunity_id,'') = '' then raise exception 'opportunity id is required'; end if;
  if jsonb_typeof(p_tasks) <> 'array' then raise exception 'research tasks must be an array'; end if;

  select * into v_policy
    from public.jhadina_venture_discovery_policies
   where owner_user_id = p_owner_user_id;

  if not found or not v_policy.enabled or not v_policy.auto_start_research then
    raise exception 'venture auto-research policy is not enabled';
  end if;

  select * into v_candidate
    from public.jhadina_venture_candidate_inbox
   where id = p_candidate_id and active = true;

  if not found then raise exception 'venture candidate not found'; end if;
  if v_candidate.recommendation <> 'research' then
    raise exception 'venture candidate is not research-ready';
  end if;

  select * into v_adoption
    from public.jhadina_venture_candidate_adoptions
   where owner_user_id = p_owner_user_id
     and candidate_id = p_candidate_id
     and opportunity_id = p_opportunity_id
     and status = 'adopted';

  if not found then raise exception 'venture candidate adoption not found'; end if;

  select * into v_existing
    from public.jhadina_opportunities
   where user_id = p_owner_user_id and id = p_opportunity_id
   for update;

  if not found then raise exception 'opportunity not found'; end if;

  if v_existing.status = 'research_pending' and v_existing.research_case_id is not null then
    return jsonb_build_object(
      'started', false,
      'alreadyStarted', true,
      'candidateId', p_candidate_id,
      'opportunityId', p_opportunity_id,
      'researchCaseId', v_existing.research_case_id,
      'approvalBasis', 'standing_venture_discovery_policy',
      'externalActionAuthorized', false,
      'automaticExperimentAuthorized', false,
      'ventureLaunchAuthorized', false,
      'moneyMovementAuthorized', false
    );
  end if;

  if v_existing.status <> 'discovered' then
    raise exception 'opportunity is not eligible to start research';
  end if;

  if coalesce(p_case->>'opportunityId','') <> p_opportunity_id
     or v_case_id <> 'research:' || p_opportunity_id then
    raise exception 'research case does not match canonical opportunity case id';
  end if;

  v_expected_task_kinds := array[
    'verify_source',
    'verify_economics',
    'verify_requirements',
    'verify_deadline'
  ];

  if v_existing.family = 'recovery' then
    v_expected_task_kinds := v_expected_task_kinds || array[
      'verify_identity','verify_entitlement','verify_jurisdiction'
    ];
  elsif v_existing.family = 'employment' then
    v_expected_task_kinds := v_expected_task_kinds || array[
      'verify_employer','verify_compensation','assess_capability'
    ];
  elsif v_existing.family = 'funding' then
    v_expected_task_kinds := v_expected_task_kinds || array[
      'assess_capability','assess_competition','assess_compliance'
    ];
  else
    v_expected_task_kinds := v_expected_task_kinds || array[
      'verify_provider','assess_margin','assess_capability','assess_competition','assess_compliance'
    ];
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
           or coalesce(task->>'status','') <> 'pending'
           or coalesce((task->>'required')::boolean, false) <> true
           or jsonb_array_length(coalesce(task->'evidenceRefs','[]'::jsonb)) <> 0
     )
  then
    raise exception 'research task set does not match canonical plan';
  end if;

  v_research_opportunity := jsonb_set(v_existing.payload, '{status}', '"research_pending"'::jsonb, true);
  v_research_opportunity := jsonb_set(v_research_opportunity, '{updatedAt}', to_jsonb(v_now), true);
  v_research_opportunity := jsonb_set(
    v_research_opportunity,
    '{metadata}',
    coalesce(v_research_opportunity->'metadata','{}'::jsonb)
      || jsonb_build_object(
        'researchApprovalBasis','standing_venture_discovery_policy',
        'researchApprovalCandidateId',p_candidate_id
      ),
    true
  );

  insert into public.jhadina_opportunity_research_cases (
    user_id,id,opportunity_id,title,status,created_at,updated_at
  ) values (
    p_owner_user_id,
    v_case_id,
    p_opportunity_id,
    p_case->>'title',
    'pending',
    coalesce((p_case->>'createdAt')::timestamptz,v_now),
    coalesce((p_case->>'updatedAt')::timestamptz,v_now)
  )
  on conflict (user_id, opportunity_id) do nothing;

  for v_task in select value from jsonb_array_elements(p_tasks)
  loop
    insert into public.jhadina_opportunity_research_tasks (
      user_id,id,research_case_id,kind,title,required,status,evidence_refs,created_at,completed_at
    ) values (
      p_owner_user_id,
      v_task->>'id',
      v_case_id,
      v_task->>'kind',
      v_task->>'title',
      true,
      'pending',
      '[]'::jsonb,
      coalesce((v_task->>'createdAt')::timestamptz,v_now),
      null
    )
    on conflict (user_id,research_case_id,kind) do nothing;
  end loop;

  update public.jhadina_opportunities
     set status = 'research_pending',
         approved_at = coalesce(approved_at,v_now),
         research_case_id = v_case_id,
         payload = v_research_opportunity,
         updated_at = v_now
   where user_id = p_owner_user_id and id = p_opportunity_id;

  insert into public.jhadina_opportunity_outbox (
    user_id,event_id,opportunity_id,event_type,payload,created_at
  ) values (
    p_owner_user_id,
    v_case_id || ':research_started',
    p_opportunity_id,
    'opportunity.research_started',
    jsonb_build_object(
      'opportunityId',p_opportunity_id,
      'researchCaseId',v_case_id,
      'candidateId',p_candidate_id,
      'status','research_pending',
      'approvalBasis','standing_venture_discovery_policy',
      'externalActionAuthorized',false,
      'automaticExperimentAuthorized',false,
      'ventureLaunchAuthorized',false,
      'moneyMovementAuthorized',false
    ),
    v_now
  )
  on conflict (user_id,event_id) do nothing;

  return jsonb_build_object(
    'started', true,
    'alreadyStarted', false,
    'candidateId', p_candidate_id,
    'opportunityId', p_opportunity_id,
    'researchCaseId', v_case_id,
    'approvalBasis', 'standing_venture_discovery_policy',
    'externalActionAuthorized', false,
    'automaticExperimentAuthorized', false,
    'ventureLaunchAuthorized', false,
    'moneyMovementAuthorized', false
  );
end;
$$;

revoke all on function public.jhadina_venture_candidate_start_research(uuid,text,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.jhadina_venture_candidate_start_research(uuid,text,text,jsonb,jsonb)
  to service_role;
