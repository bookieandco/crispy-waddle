-- SIDE-HUSTLE / VENTURE LAB RESEARCH INTAKE
-- Keeps the canonical Opportunity research RPC aligned with the Side Hustle
-- Business Factory fold. Venture-sourced business candidates gain three
-- additional evidence tasks and a RESEARCH_ONLY intake receipt. The RPC derives
-- this state from persisted canonical provenance rather than trusting caller
-- supplied metadata.

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
  v_discovery jsonb;
  v_is_venture_side_hustle boolean := false;
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

  v_discovery := v_existing.payload->'metadata'->'sideHustleDiscovery';
  v_is_venture_side_hustle := coalesce(v_discovery->>'origin','') = 'venture_factory';

  if v_is_venture_side_hustle
     and coalesce(v_discovery->>'recommendation','') <> 'research' then
    raise exception 'venture side hustle candidate is not research-ready';
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

  if v_is_venture_side_hustle then
    v_expected_task_kinds := v_expected_task_kinds || array[
      'assess_demand_thesis',
      'assess_make_it_make_sense',
      'assess_originality_ip'
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
     )
  then
    raise exception 'research task set does not match canonical plan';
  end if;

  -- Lifecycle RPCs derive payloads from persisted canonical truth. The caller
  -- may prove the expected id/status but cannot rewrite provenance/verticals.
  v_research_opportunity := jsonb_set(v_existing.payload, '{status}', '"research_pending"'::jsonb, true);
  v_research_opportunity := jsonb_set(v_research_opportunity, '{updatedAt}', to_jsonb(v_now), true);

  if v_is_venture_side_hustle then
    v_research_opportunity := jsonb_set(
      v_research_opportunity,
      '{metadata,sideHustleDiscovery,stage}',
      '"researching"'::jsonb,
      true
    );
    v_research_opportunity := jsonb_set(
      v_research_opportunity,
      '{metadata,ventureLabResearchIntake}',
      jsonb_build_object(
        'origin', 'venture_factory',
        'candidateId', v_discovery->>'candidateId',
        'researchCaseId', v_case_id,
        'stage', 'researching',
        'approvedAt', v_now,
        'authority', 'RESEARCH_ONLY',
        'requiredGates', jsonb_build_array(
          'demand_thesis',
          'make_it_make_sense',
          'originality_ip'
        ),
        'externalActionAuthorized', false,
        'automaticExperimentAuthorized', false,
        'moneyMovementAuthorized', false
      ),
      true
    );
  end if;

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
      'status', 'research_pending',
      'ventureLab', v_is_venture_side_hustle,
      'ventureLabRequiredGates', case
        when v_is_venture_side_hustle then jsonb_build_array(
          'demand_thesis',
          'make_it_make_sense',
          'originality_ip'
        )
        else '[]'::jsonb
      end
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
