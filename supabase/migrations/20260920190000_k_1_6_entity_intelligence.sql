-- K-1.6.1..K-1.6.10 durable entity intelligence over the existing knowledge graph.
alter table public.jhadina_knowledge_nodes add column if not exists owner_id uuid;
alter table public.jhadina_knowledge_nodes add column if not exists scope text not null default 'system';
alter table public.jhadina_knowledge_nodes add column if not exists canonical_key text;
alter table public.jhadina_knowledge_nodes add column if not exists aliases jsonb not null default '[]'::jsonb;
alter table public.jhadina_knowledge_nodes add column if not exists external_ids jsonb not null default '{}'::jsonb;
alter table public.jhadina_knowledge_nodes add column if not exists confidence numeric not null default 0 check(confidence between 0 and 1);
alter table public.jhadina_knowledge_nodes add column if not exists verification_state text not null default 'unverified';
alter table public.jhadina_knowledge_nodes add column if not exists superseded_by text references public.jhadina_knowledge_nodes(node_id);
alter table public.jhadina_knowledge_nodes add column if not exists updated_at timestamptz not null default now();

alter table public.jhadina_knowledge_relations add column if not exists owner_id uuid;
alter table public.jhadina_knowledge_relations add column if not exists scope text not null default 'system';
alter table public.jhadina_knowledge_relations add column if not exists confidence numeric not null default 0 check(confidence between 0 and 1);
alter table public.jhadina_knowledge_relations add column if not exists verification_state text not null default 'unverified';
alter table public.jhadina_knowledge_relations add column if not exists superseded_by text references public.jhadina_knowledge_relations(relation_id);
alter table public.jhadina_knowledge_relations add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_jhadina_knowledge_nodes_scope_canonical
on public.jhadina_knowledge_nodes(scope,canonical_key) where canonical_key is not null and superseded_by is null;
create index if not exists idx_jhadina_knowledge_nodes_label_trgm
on public.jhadina_knowledge_nodes using gin(label extensions.gin_trgm_ops);
create index if not exists idx_jhadina_knowledge_relations_from_active
on public.jhadina_knowledge_relations(from_node_id,relation_type) where superseded_by is null;
create index if not exists idx_jhadina_knowledge_relations_to_active
on public.jhadina_knowledge_relations(to_node_id,relation_type) where superseded_by is null;

create table if not exists public.jhadina_knowledge_entity_candidates(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid,
 scope text not null default 'system',
 candidate_label text not null,
 candidate_type text not null,
 proposed_canonical_key text,
 candidate_node_ids jsonb not null default '[]'::jsonb,
 confidence numeric not null default 0 check(confidence between 0 and 1),
 status text not null default 'pending' check(status in ('pending','resolved','rejected')),
 resolution_node_id text references public.jhadina_knowledge_nodes(node_id),
 evidence_ids jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.jhadina_knowledge_entity_candidates enable row level security;
revoke all on public.jhadina_knowledge_nodes,public.jhadina_knowledge_relations,public.jhadina_knowledge_entity_candidates from public,anon,authenticated;
grant select,insert,update on public.jhadina_knowledge_nodes,public.jhadina_knowledge_relations,public.jhadina_knowledge_entity_candidates to service_role;

create or replace function public.jhadina_resolve_knowledge_entity(
 p_label text,p_node_type text,p_scope text default 'system',p_owner_id uuid default null,p_limit integer default 8
) returns table(node_id text,node_type text,label text,canonical_key text,confidence numeric,verification_state text,match_score real)
language sql stable security invoker set search_path=public,pg_catalog,extensions as $$
 select n.node_id,n.node_type,n.label,n.canonical_key,n.confidence,n.verification_state,
 greatest(similarity(n.label,p_label),
   coalesce((select max(similarity(a.value#>>'{}',p_label)) from jsonb_array_elements(n.aliases) a(value)),0))::real
 from public.jhadina_knowledge_nodes n
 where n.superseded_by is null and n.scope=coalesce(p_scope,'system')
   and (p_owner_id is null or n.owner_id is null or n.owner_id=p_owner_id)
   and n.node_type=p_node_type
   and (similarity(n.label,p_label)>.08 or exists(select 1 from jsonb_array_elements(n.aliases) a(value) where similarity(a.value#>>'{}',p_label)>.08))
 order by 7 desc,n.verification_state='verified' desc,n.confidence desc,n.node_id
 limit greatest(1,least(coalesce(p_limit,8),25))
$$;

create or replace function public.jhadina_traverse_knowledge_graph(
 p_seed_node_ids text[],p_owner_id uuid default null,p_scope text default null,p_as_of timestamptz default now(),p_max_depth integer default 2,p_limit integer default 100
) returns table(depth integer,node_id text,node_type text,label text,relation_id text,relation_type text,from_node_id text,to_node_id text,provenance_refs jsonb)
language sql stable security invoker set search_path=public,pg_catalog as $$
 with recursive walk as (
   select 0 depth,n.node_id,n.node_type,n.label,null::text relation_id,null::text relation_type,null::text from_node_id,null::text to_node_id,n.provenance_refs,array[n.node_id] path
   from public.jhadina_knowledge_nodes n where n.node_id=any(p_seed_node_ids) and n.superseded_by is null
     and (p_scope is null or n.scope=p_scope) and (p_owner_id is null or n.owner_id is null or n.owner_id=p_owner_id)
     and (n.valid_from is null or n.valid_from<=p_as_of) and (n.valid_to is null or n.valid_to>=p_as_of)
   union all
   select w.depth+1,n.node_id,n.node_type,n.label,r.relation_id,r.relation_type,r.from_node_id,r.to_node_id,r.provenance_refs,w.path||n.node_id
   from walk w join public.jhadina_knowledge_relations r on r.from_node_id=w.node_id or r.to_node_id=w.node_id
   join public.jhadina_knowledge_nodes n on n.node_id=case when r.from_node_id=w.node_id then r.to_node_id else r.from_node_id end
   where w.depth<greatest(0,least(p_max_depth,5)) and not n.node_id=any(w.path)
     and r.superseded_by is null and n.superseded_by is null
     and (p_scope is null or (r.scope=p_scope and n.scope=p_scope))
     and (p_owner_id is null or ((r.owner_id is null or r.owner_id=p_owner_id) and (n.owner_id is null or n.owner_id=p_owner_id)))
     and (r.valid_from is null or r.valid_from<=p_as_of) and (r.valid_to is null or r.valid_to>=p_as_of)
     and (n.valid_from is null or n.valid_from<=p_as_of) and (n.valid_to is null or n.valid_to>=p_as_of)
 )
 select depth,node_id,node_type,label,relation_id,relation_type,from_node_id,to_node_id,provenance_refs from walk
 order by depth,node_id limit greatest(1,least(coalesce(p_limit,100),500))
$$;

create or replace function public.jhadina_detect_graph_gaps(p_owner_id uuid default null,p_scope text default null)
returns table(gap_kind text,subject text,reason text,node_or_relation_id text)
language sql stable security invoker set search_path=public,pg_catalog as $$
 select 'unsupported_entity',n.label,'Entity has no provenance references.',n.node_id
 from public.jhadina_knowledge_nodes n where n.superseded_by is null and jsonb_array_length(n.provenance_refs)=0
   and (p_scope is null or n.scope=p_scope) and (p_owner_id is null or n.owner_id is null or n.owner_id=p_owner_id)
 union all
 select 'unsupported_relation',r.relation_type,'Relation has no provenance references.',r.relation_id
 from public.jhadina_knowledge_relations r where r.superseded_by is null and jsonb_array_length(r.provenance_refs)=0
   and (p_scope is null or r.scope=p_scope) and (p_owner_id is null or r.owner_id is null or r.owner_id=p_owner_id)
 union all
 select 'stale_relation',r.relation_type,'Relation validity has expired.',r.relation_id
 from public.jhadina_knowledge_relations r where r.superseded_by is null and r.valid_to<now()
   and (p_scope is null or r.scope=p_scope) and (p_owner_id is null or r.owner_id is null or r.owner_id=p_owner_id)
$$;

revoke execute on function public.jhadina_resolve_knowledge_entity(text,text,text,uuid,integer) from public,anon,authenticated;
revoke execute on function public.jhadina_traverse_knowledge_graph(text[],uuid,text,timestamptz,integer,integer) from public,anon,authenticated;
revoke execute on function public.jhadina_detect_graph_gaps(uuid,text) from public,anon,authenticated;
grant execute on function public.jhadina_resolve_knowledge_entity(text,text,text,uuid,integer) to service_role;
grant execute on function public.jhadina_traverse_knowledge_graph(text[],uuid,text,timestamptz,integer,integer) to service_role;
grant execute on function public.jhadina_detect_graph_gaps(uuid,text) to service_role;
