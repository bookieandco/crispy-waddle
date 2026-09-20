-- K-1.4.10 evidence capture fencing.
-- Only the worker currently holding the active lease may persist provider
-- evidence for an accepted evidence_captured event.

create or replace function public.jhadina_capture_research_evidence_fenced(
  p_plan_id uuid,
  p_execution_event_id uuid,
  p_lease_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_source_kind text,
  p_source_uri text,
  p_publisher text,
  p_authority text,
  p_trust_score numeric,
  p_locator jsonb,
  p_excerpt text,
  p_content_hash text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_lease public.jhadina_research_execution_leases%rowtype;
  v_event public.jhadina_research_execution_events%rowtype;
  v_source_id uuid;
  v_evidence_id uuid;
begin
  if p_source_uri is null or btrim(p_source_uri)='' then return null; end if;
  if p_source_kind not in ('github','web','pdf','api','database','conversation','user','system') then return null; end if;
  if p_authority not in ('primary','official','secondary','community','user','system','unknown') then return null; end if;
  if p_trust_score<0 or p_trust_score>1 then return null; end if;

  select * into v_lease
  from public.jhadina_research_execution_leases
  where id=p_lease_id;
  if not found
     or v_lease.plan_id<>p_plan_id
     or v_lease.state<>'active'
     or v_lease.worker_id<>p_worker_id
     or v_lease.lease_token<>p_lease_token
     or v_lease.expires_at<=now()
  then return null; end if;

  select * into v_event
  from public.jhadina_research_execution_events
  where id=p_execution_event_id
    and plan_id=p_plan_id
    and lease_id=p_lease_id;
  if not found
     or v_event.event_type<>'evidence_captured'
     or v_event.result_status<>'accepted'
  then return null; end if;

  insert into public.jhadina_knowledge_sources(
    kind,uri,publisher,authority,trust_score,last_seen_at,metadata
  ) values(
    p_source_kind,p_source_uri,p_publisher,p_authority,p_trust_score,now(),coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(uri) do update
    set last_seen_at=now(),
        publisher=coalesce(excluded.publisher,public.jhadina_knowledge_sources.publisher),
        metadata=public.jhadina_knowledge_sources.metadata||excluded.metadata
  returning id into v_source_id;

  insert into public.jhadina_knowledge_evidence(
    source_id,locator,excerpt,content_hash,captured_at,verification_state,
    authority_score,freshness_state,metadata
  ) values(
    v_source_id,coalesce(p_locator,'{}'::jsonb),p_excerpt,p_content_hash,now(),
    'unverified',p_trust_score,'unknown',
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
      'researchPlanId',p_plan_id,
      'executionEventId',p_execution_event_id,
      'leaseId',p_lease_id
    )
  ) returning id into v_evidence_id;

  insert into public.jhadina_research_evidence_lineage(
    evidence_id,plan_id,execution_event_id,task_id
  ) values(
    v_evidence_id,p_plan_id,p_execution_event_id,v_event.task_id
  );

  return v_evidence_id;
end;
$$;

revoke execute on function public.jhadina_capture_research_evidence(
  uuid,uuid,text,text,text,text,numeric,jsonb,text,text,jsonb
) from public,anon,authenticated,service_role;

revoke execute on function public.jhadina_capture_research_evidence_fenced(
  uuid,uuid,uuid,text,text,text,text,text,text,numeric,jsonb,text,text,jsonb
) from public,anon,authenticated;
grant execute on function public.jhadina_capture_research_evidence_fenced(
  uuid,uuid,uuid,text,text,text,text,text,text,numeric,jsonb,text,text,jsonb
) to service_role;
