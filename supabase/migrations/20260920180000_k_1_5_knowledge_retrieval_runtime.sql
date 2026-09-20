-- K-1.5.1..K-1.5.10 canonical knowledge retrieval runtime.
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_jhadina_knowledge_records_subject_trgm
on public.jhadina_knowledge_records using gin (subject extensions.gin_trgm_ops);
create index if not exists idx_jhadina_knowledge_records_claim_trgm
on public.jhadina_knowledge_records using gin (claim extensions.gin_trgm_ops);
create index if not exists idx_jhadina_knowledge_evidence_record
on public.jhadina_knowledge_evidence(knowledge_record_id);

create or replace function public.jhadina_query_knowledge(
  p_query text,
  p_owner_id uuid default null,
  p_scope text default null,
  p_as_of timestamptz default now(),
  p_limit integer default 8,
  p_require_verified boolean default false
)
returns table(
  id uuid, owner_id uuid, scope text, knowledge_type text, subject text, predicate text,
  claim text, object_json jsonb, confidence numeric, verification_state text,
  authority_score numeric, freshness_score numeric, freshness_state text,
  observed_at timestamptz, valid_from timestamptz, valid_until timestamptz,
  superseded_by uuid, lexical_score real, evidence jsonb
)
language sql
stable
security invoker
set search_path=public,pg_catalog,extensions
as $$
  select k.id,k.owner_id,k.scope,k.knowledge_type,k.subject,k.predicate,k.claim,k.object_json,
         k.confidence,k.verification_state,k.authority_score,k.freshness_score,k.freshness_state,
         k.observed_at,k.valid_from,k.valid_until,k.superseded_by,
         greatest(similarity(k.subject,p_query),similarity(k.claim,p_query))::real lexical_score,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id',e.id,'sourceId',e.source_id,'authorityScore',e.authority_score,
             'verificationState',e.verification_state,'freshnessState',e.freshness_state
           ) order by e.authority_score desc,e.captured_at desc)
           from public.jhadina_knowledge_evidence e where e.knowledge_record_id=k.id
         ),'[]'::jsonb) evidence
  from public.jhadina_knowledge_records k
  where k.status='ACTIVE'
    and k.superseded_by is null
    and (p_owner_id is null or k.owner_id is null or k.owner_id=p_owner_id)
    and (p_scope is null or k.scope=p_scope)
    and (not p_require_verified or k.verification_state='verified')
    and (k.valid_from is null or k.valid_from<=p_as_of)
    and (k.valid_until is null or k.valid_until>=p_as_of)
    and k.freshness_state not in ('expired','changed')
    and (
      p_query is null or btrim(p_query)='' or
      k.subject ilike '%'||p_query||'%' or k.claim ilike '%'||p_query||'%' or
      similarity(k.subject,p_query)>.08 or similarity(k.claim,p_query)>.08
    )
  order by greatest(similarity(k.subject,p_query),similarity(k.claim,p_query)) desc,
           k.verification_state='verified' desc,k.authority_score desc,k.freshness_score desc,
           k.confidence desc,k.observed_at desc,k.id
  limit greatest(1,least(coalesce(p_limit,8),50))
$$;

revoke execute on function public.jhadina_query_knowledge(text,uuid,text,timestamptz,integer,boolean)
from public,anon,authenticated;
grant execute on function public.jhadina_query_knowledge(text,uuid,text,timestamptz,integer,boolean)
to service_role;

create table if not exists public.jhadina_knowledge_gap_events(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid null,
 query_text text not null,
 gap_kind text not null check(gap_kind in ('missing','weak','stale','contradictory')),
 subject text not null,
 reason text not null,
 research_required boolean not null default true,
 research_intent_id uuid null references public.jhadina_research_intents(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.jhadina_knowledge_gap_events enable row level security;
revoke all on public.jhadina_knowledge_gap_events from public,anon,authenticated;
grant select,insert,update on public.jhadina_knowledge_gap_events to service_role;
create index if not exists idx_jhadina_knowledge_gap_events_owner_created
on public.jhadina_knowledge_gap_events(owner_id,created_at desc);
