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
  v_sequence bigint;
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

  select coalesce(max(sequence_no),0)+1 into v_sequence
  from public.jhadina_research_execution_events
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
    v_sequence
  )
  returning * into v_lease;

  insert into public.jhadina_research_execution_events(
    plan_id, lease_id, sequence_no, event_type, payload
  ) values (
    p_plan_id, v_lease.id, v_sequence, 'admitted',
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


revoke execute on function public.jhadina_claim_research_execution(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.jhadina_claim_research_execution(uuid,uuid,text,integer) to service_role;
