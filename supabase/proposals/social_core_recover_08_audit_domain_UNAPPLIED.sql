-- SOCIAL-CORE.RECOVER.08 — REVIEW ONLY / UNAPPLIED / NOT A MIGRATION.
-- Derived from live Jhadina Supabase function checksum 148e77452cbab6a05e6bc8479a1f3d64.
-- DO NOT apply without fresh exact-project checksum, controlled cutover,
-- disposable reproduction of ledger digest behavior, and explicit approval.
-- Guard only the Social domain. Other domains preserve existing semantics.
begin;
do $preflight$
begin
  if md5(pg_get_functiondef('public.append_jhadina_audit_event(text,text,uuid,text,text,text,text,timestamptz,jsonb)'::regprocedure)) <> '148e77452cbab6a05e6bc8479a1f3d64' then
    raise exception 'SOCIAL_AUDIT_SOURCE_DRIFT_STOP';
  end if;
end
$preflight$;

CREATE OR REPLACE FUNCTION public.append_jhadina_audit_event(p_event_id text, p_request_id text, p_actor_id uuid, p_domain text, p_capability text, p_decision text, p_status text, p_occurred_at timestamp with time zone, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jhadina_audit_ledger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_head text;
  v_count bigint;
  v_hash text;
  v_payload text;
  v_row public.jhadina_audit_ledger;
begin
  if p_actor_id is null then raise exception 'JHADINA_AUDIT_ACTOR_REQUIRED'; end if;
  if p_event_id is null or p_request_id is null then raise exception 'JHADINA_AUDIT_ID_REQUIRED'; end if;
  if p_domain is null or p_capability is null then raise exception 'JHADINA_AUDIT_SCOPE_REQUIRED'; end if;
  if p_decision not in ('allow','deny','approval_required') then raise exception 'JHADINA_AUDIT_DECISION_INVALID'; end if;
  if p_status not in ('started','approval_required','completed','denied','failed') then
    raise exception 'JHADINA_AUDIT_STATUS_INVALID';
  end if;

  if auth.role() is distinct from 'service_role'
     and (auth.uid() is null or auth.uid() <> p_actor_id) then
    raise exception 'JHADINA_AUDIT_ACTOR_MISMATCH';
  end if;

  -- Social audit events are authorization evidence only from the verified server.
  -- This does not affect other Action Core audit domains.
  if p_domain = 'social' and auth.role() is distinct from 'service_role' then
    raise exception 'JHADINA_SOCIAL_AUDIT_SERVER_ONLY';
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
$function$


-- Keep existing grants unchanged; authenticated calls in other domains
-- preserve current functionality. For p_domain='social', only service_role
-- credentials pass the internal assertion. Never let client JWTs sign as service_role.
commit;
