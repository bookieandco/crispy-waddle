-- K-1.4.8 concrete ActionExecutor -> canonical execution receipt bridge.
-- This RPC is service-role only and refuses to mint Research authority unless
-- the same request has already crossed ActionExecutor's durable "started"
-- audit boundary for the verified actor and research.run capability.

create or replace function public.jhadina_authorize_research_action(
  p_plan_id uuid,
  p_policy_decision_id uuid,
  p_request_id text,
  p_actor_id uuid,
  p_audit_domain text default 'research'
)
returns uuid
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_plan public.jhadina_research_plans%rowtype;
  v_decision public.jhadina_research_policy_decisions%rowtype;
  v_receipt public.jhadina_execution_receipts%rowtype;
begin
  if p_request_id is null or btrim(p_request_id)='' or p_actor_id is null then return null; end if;
  if p_audit_domain is null or btrim(p_audit_domain)='' then return null; end if;

  if not exists(
    select 1
    from public.jhadina_audit_event a
    where a.domain=p_audit_domain
      and a.request_id=p_request_id
      and a.actor_id=p_actor_id::text
      and a.capability='research.run'
      and a.status='started'
      and a.decision='allow'
  ) then
    return null;
  end if;

  select * into v_plan
  from public.jhadina_research_plans
  where id=p_plan_id
  for update;
  if not found or v_plan.status not in ('approved','running') or v_plan.content_hash is null then
    return null;
  end if;

  select * into v_decision
  from public.jhadina_research_policy_decisions
  where id=p_policy_decision_id and plan_id=p_plan_id
  for update;
  if not found or v_decision.decision<>'allow' then return null; end if;

  select * into v_receipt
  from public.jhadina_execution_receipts
  where request_id=p_request_id and action_id=p_plan_id::text
  for update;

  if found then
    if v_receipt.actor_id<>p_actor_id
       or v_receipt.capability<>'research.run'
       or v_receipt.approval_state<>'APPROVED'
       or v_receipt.execution_state<>'NOT_EXECUTED'
       or coalesce(v_receipt.authorization_context->>'policyDecisionId','')<>p_policy_decision_id::text
       or coalesce(v_receipt.authorization_context->>'planContentHash','')<>v_plan.content_hash
    then
      return null;
    end if;
  else
    insert into public.jhadina_execution_receipts(
      request_id,action_id,actor_id,capability,authorization_context,
      approval_state,execution_state,approved_at,result_metadata
    ) values(
      p_request_id,p_plan_id::text,p_actor_id,'research.run',
      jsonb_build_object(
        'policyDecisionId',p_policy_decision_id,
        'planId',p_plan_id,
        'planContentHash',v_plan.content_hash,
        'auditDomain',p_audit_domain,
        'actionExecutorRequestId',p_request_id
      ),
      'APPROVED','NOT_EXECUTED',now(),'{}'::jsonb
    ) returning * into v_receipt;
  end if;

  update public.jhadina_research_policy_decisions
     set audit_receipt_id=v_receipt.receipt_id,
         action_proposal_id=p_request_id,
         capability='research.run',
         admitted_for_execution=true
   where id=p_policy_decision_id;

  if not found then return null; end if;
  return v_receipt.receipt_id;
end;
$$;

revoke execute on function public.jhadina_authorize_research_action(uuid,uuid,text,uuid,text)
from public,anon,authenticated;
grant execute on function public.jhadina_authorize_research_action(uuid,uuid,text,uuid,text)
to service_role;
