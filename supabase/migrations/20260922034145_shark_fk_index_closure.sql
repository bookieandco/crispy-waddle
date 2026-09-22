-- SHARK-CONVERGE.8: covering indexes for live SHARK/shared-launch foreign keys.
create index if not exists jhadina_token_actor_edges_launch_id_idx
  on public.jhadina_token_actor_edges (launch_id);

create index if not exists jhadina_token_launches_owner_id_idx
  on public.jhadina_token_launches (owner_id);
