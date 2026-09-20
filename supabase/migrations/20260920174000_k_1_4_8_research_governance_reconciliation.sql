-- K-1.4.8 Governance reconciliation.
-- A Research planning decision cannot become execution authority without a
-- canonical Action/Execution receipt for research.run.

create or replace function public.jhadina_validate_research_policy_admission()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_receipt public.jhadina_execution_receipts%rowtype;
  v_plan public.jhadina_research_plans%rowtype;
begin
  if not new.admitted_for_execution then return new; end if;

  if new.decision <> 'allow'
     or new.capability <> 'research.run'
     or new.audit_receipt_id is null
     or new.action_proposal_id is null
     or btrim(new.action_proposal_id) = ''
  then
    raise exception 'research_policy_admission_requires_canonical_authority';
  end if;

  select * into v_receipt
  from public.jhadina_execution_receipts
  where receipt_id = new.audit_receipt_id;

  if not found
     or v_receipt.capability <> 'research.run'
     or v_receipt.approval_state <> 'APPROVED'
     or v_receipt.execution_state <> 'NOT_EXECUTED'
  then
    raise exception 'research_policy_admission_receipt_invalid';
  end if;

  select * into v_plan
  from public.jhadina_research_plans
  where id = new.plan_id;

  if not found
     or v_plan.status not in ('approved','running')
     or v_plan.content_hash is null
  then
    raise exception 'research_policy_admission_plan_invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jhadina_validate_research_policy_admission
on public.jhadina_research_policy_decisions;

create trigger trg_jhadina_validate_research_policy_admission
before insert or update on public.jhadina_research_policy_decisions
for each row execute function public.jhadina_validate_research_policy_admission();

revoke execute on function public.jhadina_validate_research_policy_admission()
from public,anon,authenticated;

create or replace function public.jhadina_bind_research_policy_decision(
  p_decision_id uuid,
  p_receipt_id uuid,
  p_action_proposal_id text
)
returns boolean
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_decision public.jhadina_research_policy_decisions%rowtype;
  v_receipt public.jhadina_execution_receipts%rowtype;
  v_plan public.jhadina_research_plans%rowtype;
begin
  if p_action_proposal_id is null or btrim(p_action_proposal_id)='' then return false; end if;

  select * into v_decision
  from public.jhadina_research_policy_decisions
  where id=p_decision_id
  for update;
  if not found or v_decision.decision<>'allow' then return false; end if;

  select * into v_plan
  from public.jhadina_research_plans
  where id=v_decision.plan_id
  for update;
  if not found or v_plan.status not in ('approved','running') or v_plan.content_hash is null then return false; end if;

  select * into v_receipt
  from public.jhadina_execution_receipts
  where receipt_id=p_receipt_id
  for update;
  if not found
     or v_receipt.capability<>'research.run'
     or v_receipt.approval_state<>'APPROVED'
     or v_receipt.execution_state<>'NOT_EXECUTED'
  then return false; end if;

  update public.jhadina_research_policy_decisions
     set audit_receipt_id=p_receipt_id,
         action_proposal_id=p_action_proposal_id,
         capability='research.run',
         admitted_for_execution=true
   where id=p_decision_id;

  return found;
end;
$$;

create or replace function public.jhadina_research_execution_admissible(p_decision_id uuid)
returns boolean
language sql
security invoker
set search_path=public,pg_catalog
stable
as $$
  select exists(
    select 1
    from public.jhadina_research_policy_decisions d
    join public.jhadina_research_plans p on p.id=d.plan_id
    join public.jhadina_execution_receipts r on r.receipt_id=d.audit_receipt_id
    where d.id=p_decision_id
      and d.decision='allow'
      and d.admitted_for_execution
      and d.capability='research.run'
      and d.action_proposal_id is not null
      and btrim(d.action_proposal_id)<>''
      and p.status in ('approved','running')
      and p.content_hash is not null
      and r.capability='research.run'
      and r.approval_state='APPROVED'
      and r.execution_state='NOT_EXECUTED'
  );
$$;

revoke execute on function public.jhadina_bind_research_policy_decision(uuid,uuid,text)
from public,anon,authenticated;
grant execute on function public.jhadina_bind_research_policy_decision(uuid,uuid,text)
to service_role;

revoke execute on function public.jhadina_research_execution_admissible(uuid)
from public,anon,authenticated;
grant execute on function public.jhadina_research_execution_admissible(uuid)
to service_role;
