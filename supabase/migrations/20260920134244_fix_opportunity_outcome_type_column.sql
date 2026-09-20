-- Production corrective migration discovered by transactional runtime acceptance.
-- Re-declares both outcome RPCs with the canonical opportunity_type column.

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
    'type', v_existing.opportunity_type,
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
    'type', v_existing.opportunity_type,
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

revoke all on function public.jhadina_opportunity_record_outcome(text, jsonb, jsonb, jsonb) from anon;
revoke all on function public.jhadina_opportunity_record_trusted_outcome(uuid, text, jsonb, jsonb, jsonb) from anon, authenticated;
grant execute on function public.jhadina_opportunity_record_outcome(text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.jhadina_opportunity_record_trusted_outcome(uuid, text, jsonb, jsonb, jsonb) to service_role;
