-- GEV-P6: durable canonical knowledge graph storage for spatial and other domains.
-- Nodes/relations are append-only identity records; temporal corrections use new
-- ids/relations rather than mutation of prior provenance.

create table if not exists public.jhadina_knowledge_nodes (
  node_id text primary key,
  node_type text not null,
  label text not null,
  attributes jsonb not null default '{}'::jsonb,
  provenance_refs jsonb not null default '[]'::jsonb,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.jhadina_knowledge_relations (
  relation_id text primary key,
  from_node_id text not null references public.jhadina_knowledge_nodes(node_id),
  to_node_id text not null references public.jhadina_knowledge_nodes(node_id),
  relation_type text not null,
  attributes jsonb not null default '{}'::jsonb,
  provenance_refs jsonb not null default '[]'::jsonb,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_knowledge_relations_from_idx on public.jhadina_knowledge_relations (from_node_id, relation_type);
create index if not exists jhadina_knowledge_relations_to_idx on public.jhadina_knowledge_relations (to_node_id, relation_type);

alter table public.jhadina_knowledge_nodes enable row level security;
alter table public.jhadina_knowledge_relations enable row level security;

create policy jhadina_knowledge_nodes_service_role_only
  on public.jhadina_knowledge_nodes as restrictive for all to service_role using (true) with check (true);
create policy jhadina_knowledge_relations_service_role_only
  on public.jhadina_knowledge_relations as restrictive for all to service_role using (true) with check (true);

revoke all on public.jhadina_knowledge_nodes from anon, authenticated;
revoke all on public.jhadina_knowledge_relations from anon, authenticated;
revoke update, delete on public.jhadina_knowledge_nodes from service_role;
revoke update, delete on public.jhadina_knowledge_relations from service_role;
grant select, insert on public.jhadina_knowledge_nodes to service_role;
grant select, insert on public.jhadina_knowledge_relations to service_role;

create or replace function public.jhadina_knowledge_graph_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'JHADINA_KNOWLEDGE_GRAPH_APPEND_ONLY';
end;
$$;

drop trigger if exists jhadina_knowledge_nodes_no_update_delete on public.jhadina_knowledge_nodes;
create trigger jhadina_knowledge_nodes_no_update_delete before update or delete on public.jhadina_knowledge_nodes
for each row execute function public.jhadina_knowledge_graph_append_only();

drop trigger if exists jhadina_knowledge_relations_no_update_delete on public.jhadina_knowledge_relations;
create trigger jhadina_knowledge_relations_no_update_delete before update or delete on public.jhadina_knowledge_relations
for each row execute function public.jhadina_knowledge_graph_append_only();
