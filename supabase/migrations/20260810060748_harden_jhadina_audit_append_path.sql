create extension if not exists pgcrypto;

alter table public.jhadina_audit_ledger
  add column if not exists status text not null default 'completed',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.jhadina_audit_ledger
  drop constraint if exists jhadina_audit_ledger_decision_check;
alter table public.jhadina_audit_ledger
  add constraint jhadina_audit_ledger_decision_check check (decision in ('allow','deny','approval_required'));

revoke all on public.jhadina_audit_ledger from public, anon, authenticated;
revoke all on public.jhadina_audit_ledger_head from public, anon, authenticated;

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
security definer
set search_path = public
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
  if p_status not in ('started','completed','denied','failed') then raise exception 'JHADINA_AUDIT_STATUS_INVALID'; end if;

  select head_hash, event_count into v_head, v_count
  from public.jhadina_audit_ledger_head
  where id = true
  for update;

  if not found then
    raise exception 'JHADINA_AUDIT_HEAD_MISSING';
  end if;

  v_payload := concat_ws('|', p_event_id, p_request_id, p_actor_id::text, p_domain, p_capability, p_decision, p_status, coalesce(p_occurred_at::text,''), v_head, coalesce(p_metadata::text,'{}'));
  v_hash := encode(digest(v_payload, 'sha256'), 'hex');

  insert into public.jhadina_audit_ledger(event_id, request_id, actor_id, domain, capability, decision, status, occurred_at, previous_hash, event_hash, metadata)
  values (p_event_id, p_request_id, p_actor_id, p_domain, p_capability, p_decision, p_status, coalesce(p_occurred_at, now()), v_head, v_hash, coalesce(p_metadata,'{}'))
  returning * into v_row;

  update public.jhadina_audit_ledger_head
  set head_hash = v_hash, event_count = v_count + 1, updated_at = now()
  where id = true;

  return v_row;
end;
$$;

revoke all on function public.append_jhadina_audit_event(text,text,uuid,text,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.append_jhadina_audit_event(text,text,uuid,text,text,text,text,timestamptz,jsonb) to service_role;
