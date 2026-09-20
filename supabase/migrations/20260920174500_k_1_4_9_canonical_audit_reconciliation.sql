-- K-1.4.9 canonical audit-ledger reconciliation.
-- The live project uses jhadina_audit_ledger + jhadina_audit_ledger_head.
-- Preserve that as the only authoritative ActionExecutor audit surface.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.jhadina_audit_ledger (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  request_id text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  domain text not null,
  capability text not null,
  decision text not null check (decision in ('allow','deny','approval_required')),
  occurred_at timestamptz not null default now(),
  previous_hash text not null,
  event_hash text not null unique,
  created_at timestamptz not null default now(),
  status text not null default 'completed',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.jhadina_audit_ledger_head (
  id boolean primary key default true check (id=true),
  head_hash text not null default 'GENESIS',
  event_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.jhadina_audit_ledger_head(id,head_hash,event_count)
values(true,'GENESIS',0)
on conflict(id) do nothing;

alter table public.jhadina_audit_ledger enable row level security;
alter table public.jhadina_audit_ledger_head enable row level security;

revoke all on public.jhadina_audit_ledger from public,anon,authenticated;
revoke all on public.jhadina_audit_ledger_head from public,anon,authenticated;
grant select,insert on public.jhadina_audit_ledger to service_role;
grant select,update on public.jhadina_audit_ledger_head to service_role;

create or replace function public.prevent_jhadina_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
begin
  raise exception 'JHADINA_AUDIT_LEDGER_APPEND_ONLY';
end;
$$;

drop trigger if exists trg_prevent_jhadina_audit_mutation on public.jhadina_audit_ledger;
create trigger trg_prevent_jhadina_audit_mutation
before update or delete on public.jhadina_audit_ledger
for each row execute function public.prevent_jhadina_audit_mutation();

revoke execute on function public.prevent_jhadina_audit_mutation()
from public,anon,authenticated;

-- Remove the obsolete text-actor overload if a clean replay created it from
-- the older migration snapshot. The canonical UUID actor function follows.
drop function if exists public.append_jhadina_audit_event(
  text,text,text,text,text,text,text,timestamptz,jsonb
);

create or replace function public.append_jhadina_audit_event(
  p_event_id text,
  p_request_id text,
  p_actor_id uuid,
  p_domain text,
  p_capability text,
  p_decision text,
  p_status text,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns public.jhadina_audit_ledger
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_head text;
  v_count bigint;
  v_hash text;
  v_payload text;
  v_row public.jhadina_audit_ledger;
begin
  if p_actor_id is null then raise exception 'JHADINA_AUDIT_ACTOR_REQUIRED'; end if;
  if p_event_id is null or p_request_id is null then raise exception 'JHADINA_AUDIT_ID_REQUIRED'; end if;
  if p_decision not in ('allow','deny','approval_required') then raise exception 'JHADINA_AUDIT_DECISION_INVALID'; end if;
  if p_status not in ('started','approval_required','completed','denied','failed') then
    raise exception 'JHADINA_AUDIT_STATUS_INVALID';
  end if;

  select head_hash,event_count into v_head,v_count
  from public.jhadina_audit_ledger_head
  where id=true
  for update;
  if not found then raise exception 'JHADINA_AUDIT_HEAD_MISSING'; end if;

  v_payload:=concat_ws(
    '|',p_event_id,p_request_id,p_actor_id::text,p_domain,p_capability,
    p_decision,p_status,coalesce(p_occurred_at::text,''),v_head,coalesce(p_metadata::text,'{}')
  );
  v_hash:=encode(extensions.digest(v_payload,'sha256'),'hex');

  insert into public.jhadina_audit_ledger(
    event_id,request_id,actor_id,domain,capability,decision,status,
    occurred_at,previous_hash,event_hash,metadata
  ) values(
    p_event_id,p_request_id,p_actor_id,p_domain,p_capability,p_decision,p_status,
    coalesce(p_occurred_at,now()),v_head,v_hash,coalesce(p_metadata,'{}'::jsonb)
  )
  returning * into v_row;

  update public.jhadina_audit_ledger_head
     set head_hash=v_hash,event_count=v_count+1,updated_at=now()
   where id=true;

  return v_row;
end;
$$;

revoke execute on function public.append_jhadina_audit_event(
  text,text,uuid,text,text,text,text,timestamptz,jsonb
) from public,anon,authenticated;
grant execute on function public.append_jhadina_audit_event(
  text,text,uuid,text,text,text,text,timestamptz,jsonb
) to service_role;

-- On a clean replay the obsolete table from the older snapshot is empty.
-- Retire it only when empty; never discard historical events on an upgraded DB.
do $$
begin
  if to_regclass('public.jhadina_audit_event') is not null then
    if not exists(select 1 from public.jhadina_audit_event) then
      drop table public.jhadina_audit_event;
    end if;
  end if;
end $$;

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
    from public.jhadina_audit_ledger a
    where a.domain=p_audit_domain
      and a.request_id=p_request_id
      and a.actor_id=p_actor_id
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
