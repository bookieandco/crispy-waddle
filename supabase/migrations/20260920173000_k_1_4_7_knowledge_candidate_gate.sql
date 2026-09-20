-- K-1.4.7 KnowledgeCandidate gate.
-- Research evidence is lineage-bound and cannot jump directly into canonical Knowledge.

create table if not exists public.jhadina_research_evidence_lineage (
  evidence_id uuid primary key references public.jhadina_knowledge_evidence(id) on delete restrict,
  plan_id uuid not null references public.jhadina_research_plans(id) on delete restrict,
  execution_event_id uuid not null references public.jhadina_research_execution_events(id) on delete restrict,
  task_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.jhadina_knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jhadina_research_plans(id) on delete restrict,
  execution_event_id uuid not null references public.jhadina_research_execution_events(id) on delete restrict,
  subject text not null,
  claim text not null,
  predicate text not null default 'asserts',
  object_json jsonb not null default '{}'::jsonb,
  confidence numeric not null,
  observed_at timestamptz not null default now(),
  minimum_authority_score numeric not null default 0,
  minimum_sources integer not null default 1,
  require_fresh boolean not null default true,
  contradiction_state text not null default 'none',
  status text not null default 'pending',
  evaluation jsonb not null default '{}'::jsonb,
  content_hash text not null,
  admitted_knowledge_record_id uuid references public.jhadina_knowledge_records(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jhadina_knowledge_candidate_confidence_ck check (confidence between 0 and 1),
  constraint jhadina_knowledge_candidate_authority_ck check (minimum_authority_score between 0 and 1),
  constraint jhadina_knowledge_candidate_sources_ck check (minimum_sources >= 1),
  constraint jhadina_knowledge_candidate_contradiction_ck check (contradiction_state in ('none','unresolved','resolved')),
  constraint jhadina_knowledge_candidate_status_ck check (status in ('pending','validated','disputed','rejected','admitted'))
);

create table if not exists public.jhadina_knowledge_candidate_evidence (
  candidate_id uuid not null references public.jhadina_knowledge_candidates(id) on delete restrict,
  evidence_id uuid not null references public.jhadina_knowledge_evidence(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(candidate_id,evidence_id)
);

create table if not exists public.jhadina_knowledge_record_evidence (
  knowledge_record_id uuid not null references public.jhadina_knowledge_records(id) on delete restrict,
  evidence_id uuid not null references public.jhadina_knowledge_evidence(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(knowledge_record_id,evidence_id)
);

create index if not exists jhadina_knowledge_candidates_status_idx
  on public.jhadina_knowledge_candidates(status,created_at);
create index if not exists jhadina_knowledge_candidates_plan_idx
  on public.jhadina_knowledge_candidates(plan_id,created_at);
create index if not exists jhadina_research_evidence_lineage_plan_idx
  on public.jhadina_research_evidence_lineage(plan_id,execution_event_id);

alter table public.jhadina_research_evidence_lineage enable row level security;
alter table public.jhadina_knowledge_candidates enable row level security;
alter table public.jhadina_knowledge_candidate_evidence enable row level security;
alter table public.jhadina_knowledge_record_evidence enable row level security;

revoke all on public.jhadina_research_evidence_lineage from public,anon,authenticated;
revoke all on public.jhadina_knowledge_candidates from public,anon,authenticated;
revoke all on public.jhadina_knowledge_candidate_evidence from public,anon,authenticated;
revoke all on public.jhadina_knowledge_record_evidence from public,anon,authenticated;

grant select,insert,update on public.jhadina_knowledge_sources to service_role;
grant select,insert,update on public.jhadina_knowledge_evidence to service_role;
grant select,insert,update on public.jhadina_knowledge_records to service_role;
grant select,insert on public.jhadina_research_evidence_lineage to service_role;
grant select,insert,update on public.jhadina_knowledge_candidates to service_role;
grant select,insert on public.jhadina_knowledge_candidate_evidence to service_role;
grant select,insert on public.jhadina_knowledge_record_evidence to service_role;
grant select on public.jhadina_research_execution_events to service_role;

drop policy if exists jhadina_research_evidence_lineage_service_role on public.jhadina_research_evidence_lineage;
create policy jhadina_research_evidence_lineage_service_role on public.jhadina_research_evidence_lineage
for all to service_role using(true) with check(true);
drop policy if exists jhadina_knowledge_candidates_service_role on public.jhadina_knowledge_candidates;
create policy jhadina_knowledge_candidates_service_role on public.jhadina_knowledge_candidates
for all to service_role using(true) with check(true);
drop policy if exists jhadina_knowledge_candidate_evidence_service_role on public.jhadina_knowledge_candidate_evidence;
create policy jhadina_knowledge_candidate_evidence_service_role on public.jhadina_knowledge_candidate_evidence
for all to service_role using(true) with check(true);
drop policy if exists jhadina_knowledge_record_evidence_service_role on public.jhadina_knowledge_record_evidence;
create policy jhadina_knowledge_record_evidence_service_role on public.jhadina_knowledge_record_evidence
for all to service_role using(true) with check(true);

create or replace function public.jhadina_capture_research_evidence(
  p_plan_id uuid,
  p_execution_event_id uuid,
  p_source_kind text,
  p_source_uri text,
  p_publisher text default null,
  p_authority text default 'unknown',
  p_trust_score numeric default 0,
  p_locator jsonb default '{}'::jsonb,
  p_excerpt text default null,
  p_content_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public,pg_catalog
as $$
declare
  v_event public.jhadina_research_execution_events%rowtype;
  v_source_id uuid;
  v_evidence_id uuid;
begin
  if p_source_uri is null or btrim(p_source_uri)='' then return null; end if;
  if p_source_kind not in ('github','web','pdf','api','database','conversation','user','system') then return null; end if;
  if p_authority not in ('primary','official','secondary','community','user','system','unknown') then return null; end if;
  if p_trust_score < 0 or p_trust_score > 1 then return null; end if;

  select * into v_event from public.jhadina_research_execution_events
  where id=p_execution_event_id and plan_id=p_plan_id;
  if not found or v_event.event_type not in ('task_completed','evidence_captured') then return null; end if;

  insert into public.jhadina_knowledge_sources(kind,uri,publisher,authority,trust_score,last_seen_at,metadata)
  values(p_source_kind,p_source_uri,p_publisher,p_authority,p_trust_score,now(),coalesce(p_metadata,'{}'::jsonb))
  on conflict(uri) do update
    set last_seen_at=now(),
        publisher=coalesce(excluded.publisher,public.jhadina_knowledge_sources.publisher),
        metadata=public.jhadina_knowledge_sources.metadata || excluded.metadata
  returning id into v_source_id;

  insert into public.jhadina_knowledge_evidence(
    source_id,locator,excerpt,content_hash,captured_at,verification_state,authority_score,freshness_state,metadata
  ) values(
    v_source_id,coalesce(p_locator,'{}'::jsonb),p_excerpt,p_content_hash,now(),'unverified',
    p_trust_score,'unknown',
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('researchPlanId',p_plan_id,'executionEventId',p_execution_event_id)
  ) returning id into v_evidence_id;

  insert into public.jhadina_research_evidence_lineage(evidence_id,plan_id,execution_event_id,task_id)
  values(v_evidence_id,p_plan_id,p_execution_event_id,v_event.task_id);

  return v_evidence_id;
end;
$$;

create or replace function public.jhadina_verify_knowledge_evidence(
  p_evidence_id uuid,
  p_verification_state text,
  p_authority_score numeric,
  p_freshness_state text,
  p_last_verified_at timestamptz default now()
)
returns boolean
language plpgsql
security invoker
set search_path = public,pg_catalog
as $$
begin
  if p_verification_state not in ('unverified','provisional','verified','disputed','stale','rejected') then return false; end if;
  if p_freshness_state not in ('fresh','stale','expired','changed','unknown') then return false; end if;
  if p_authority_score < 0 or p_authority_score > 1 then return false; end if;
  update public.jhadina_knowledge_evidence
     set verification_state=p_verification_state,
         authority_score=p_authority_score,
         freshness_state=p_freshness_state,
         last_verified_at=p_last_verified_at,
         updated_at=now()
   where id=p_evidence_id;
  return found;
end;
$$;

create or replace function public.jhadina_create_knowledge_candidate(
  p_plan_id uuid,
  p_execution_event_id uuid,
  p_subject text,
  p_claim text,
  p_predicate text,
  p_object_json jsonb,
  p_confidence numeric,
  p_evidence_ids uuid[],
  p_minimum_authority_score numeric default 0,
  p_minimum_sources integer default 1,
  p_require_fresh boolean default true,
  p_observed_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = public,pg_catalog
as $$
declare
  v_id uuid;
  v_hash text;
  v_event_exists boolean;
  v_expected integer;
  v_linked integer;
begin
  if p_subject is null or btrim(p_subject)='' or p_claim is null or btrim(p_claim)='' or p_predicate is null or btrim(p_predicate)='' then return null; end if;
  if p_confidence < 0 or p_confidence > 1 then return null; end if;
  if p_minimum_authority_score < 0 or p_minimum_authority_score > 1 or p_minimum_sources < 1 then return null; end if;
  if p_evidence_ids is null or cardinality(p_evidence_ids)=0 then return null; end if;

  select exists(select 1 from public.jhadina_research_execution_events where id=p_execution_event_id and plan_id=p_plan_id)
  into v_event_exists;
  if not v_event_exists then return null; end if;

  select count(distinct x) into v_expected from unnest(p_evidence_ids) x;
  select count(*) into v_linked
  from public.jhadina_research_evidence_lineage l
  where l.plan_id=p_plan_id and l.evidence_id=any(p_evidence_ids);
  if v_linked <> v_expected then return null; end if;

  v_hash:=encode(extensions.digest(
    jsonb_build_object(
      'planId',p_plan_id,'eventId',p_execution_event_id,'subject',p_subject,'claim',p_claim,
      'predicate',p_predicate,'object',coalesce(p_object_json,'{}'::jsonb),'evidence',to_jsonb(p_evidence_ids)
    )::text,'sha256'
  ),'hex');

  insert into public.jhadina_knowledge_candidates(
    plan_id,execution_event_id,subject,claim,predicate,object_json,confidence,observed_at,
    minimum_authority_score,minimum_sources,require_fresh,content_hash
  ) values(
    p_plan_id,p_execution_event_id,p_subject,p_claim,p_predicate,coalesce(p_object_json,'{}'::jsonb),
    p_confidence,p_observed_at,p_minimum_authority_score,p_minimum_sources,p_require_fresh,v_hash
  ) returning id into v_id;

  insert into public.jhadina_knowledge_candidate_evidence(candidate_id,evidence_id)
  select distinct v_id, x from unnest(p_evidence_ids) x;

  return v_id;
end;
$$;

create or replace function public.jhadina_set_candidate_contradiction(
  p_candidate_id uuid,
  p_state text
)
returns boolean
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
begin
  if p_state not in ('none','unresolved','resolved') then return false; end if;
  update public.jhadina_knowledge_candidates
     set contradiction_state=p_state,status=case when p_state='unresolved' then 'disputed' else status end,updated_at=now()
   where id=p_candidate_id and status<>'admitted';
  return found;
end;
$$;

create or replace function public.jhadina_evaluate_knowledge_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_candidate public.jhadina_knowledge_candidates%rowtype;
  v_evidence_count integer;
  v_sources integer;
  v_min_authority numeric;
  v_all_verified boolean;
  v_all_fresh boolean;
  v_reasons jsonb:='[]'::jsonb;
  v_status text;
begin
  select * into v_candidate from public.jhadina_knowledge_candidates where id=p_candidate_id for update;
  if not found then return null; end if;
  if v_candidate.status='admitted' then return v_candidate.evaluation || jsonb_build_object('status','admitted'); end if;

  select count(*),count(distinct e.source_id),coalesce(min(e.authority_score),0),
         coalesce(bool_and(e.verification_state='verified'),false),
         coalesce(bool_and(e.freshness_state='fresh'),false)
    into v_evidence_count,v_sources,v_min_authority,v_all_verified,v_all_fresh
  from public.jhadina_knowledge_candidate_evidence ce
  join public.jhadina_knowledge_evidence e on e.id=ce.evidence_id
  where ce.candidate_id=p_candidate_id;

  if v_candidate.contradiction_state='unresolved' then
    v_status:='disputed';
    v_reasons:=v_reasons || jsonb_build_array('unresolved_contradiction');
  else
    if v_evidence_count<1 then v_reasons:=v_reasons||jsonb_build_array('evidence_required'); end if;
    if v_sources<v_candidate.minimum_sources then v_reasons:=v_reasons||jsonb_build_array('insufficient_source_corroboration'); end if;
    if v_min_authority<v_candidate.minimum_authority_score then v_reasons:=v_reasons||jsonb_build_array('authority_below_threshold'); end if;
    if not v_all_verified then v_reasons:=v_reasons||jsonb_build_array('unverified_evidence'); end if;
    if v_candidate.require_fresh and not v_all_fresh then v_reasons:=v_reasons||jsonb_build_array('stale_or_changed_evidence'); end if;
    v_status:=case when jsonb_array_length(v_reasons)=0 then 'validated' else 'rejected' end;
  end if;

  update public.jhadina_knowledge_candidates
     set status=v_status,
         evaluation=jsonb_build_object(
           'status',v_status,'reasons',v_reasons,'evidenceCount',v_evidence_count,'distinctSources',v_sources,
           'minimumAuthorityScore',v_min_authority,'allVerified',v_all_verified,'allFresh',v_all_fresh,'evaluatedAt',now()
         ),
         updated_at=now()
   where id=p_candidate_id;

  return jsonb_build_object(
    'status',v_status,'reasons',v_reasons,'evidenceCount',v_evidence_count,'distinctSources',v_sources,
    'minimumAuthorityScore',v_min_authority,'allVerified',v_all_verified,'allFresh',v_all_fresh
  );
end;
$$;

create or replace function public.jhadina_admit_knowledge_candidate(p_candidate_id uuid)
returns uuid
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_eval jsonb;
  v_candidate public.jhadina_knowledge_candidates%rowtype;
  v_record_id uuid;
  v_authority numeric;
  v_evidence_ids jsonb;
begin
  v_eval:=public.jhadina_evaluate_knowledge_candidate(p_candidate_id);
  if v_eval is null or v_eval->>'status'<>'validated' then return null; end if;

  select * into v_candidate from public.jhadina_knowledge_candidates where id=p_candidate_id for update;
  if v_candidate.status='admitted' then return v_candidate.admitted_knowledge_record_id; end if;

  select coalesce(min(e.authority_score),0),coalesce(jsonb_agg(e.id order by e.id),'[]'::jsonb)
    into v_authority,v_evidence_ids
  from public.jhadina_knowledge_candidate_evidence ce
  join public.jhadina_knowledge_evidence e on e.id=ce.evidence_id
  where ce.candidate_id=p_candidate_id;

  insert into public.jhadina_knowledge_records(
    subject,claim,confidence,status,evidence,scope,knowledge_type,predicate,object_json,
    observed_at,verification_state,authority_score,freshness_score,content_hash,version,
    last_verified_at,freshness_state,content_changed,last_checked_at
  ) values(
    v_candidate.subject,v_candidate.claim,v_candidate.confidence,'ACTIVE',v_evidence_ids,'system','fact',
    v_candidate.predicate,v_candidate.object_json,v_candidate.observed_at,'verified',v_authority,1,
    v_candidate.content_hash,1,now(),'fresh',false,now()
  ) returning id into v_record_id;

  insert into public.jhadina_knowledge_record_evidence(knowledge_record_id,evidence_id)
  select v_record_id,evidence_id from public.jhadina_knowledge_candidate_evidence where candidate_id=p_candidate_id;

  update public.jhadina_knowledge_candidates
     set status='admitted',admitted_knowledge_record_id=v_record_id,updated_at=now()
   where id=p_candidate_id;

  return v_record_id;
end;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in(
      'jhadina_capture_research_evidence','jhadina_verify_knowledge_evidence',
      'jhadina_create_knowledge_candidate','jhadina_set_candidate_contradiction',
      'jhadina_evaluate_knowledge_candidate','jhadina_admit_knowledge_candidate'
    )
  loop
    execute format('revoke execute on function %s from public,anon,authenticated',r.signature);
    execute format('grant execute on function %s to service_role',r.signature);
  end loop;
end $$;
