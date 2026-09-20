-- SHARK-QA.16D: durable actor reputation must retain attribution confidence.
alter table public.jhadina_token_actor_edges
  add column if not exists confidence numeric;

update public.jhadina_token_actor_edges
set confidence = 1
where confidence is null
  and actor_kind = 'wallet'
  and role = 'deployed';

alter table public.jhadina_token_actor_edges
  drop constraint if exists jhadina_token_actor_edges_confidence_check;
alter table public.jhadina_token_actor_edges
  add constraint jhadina_token_actor_edges_confidence_check
  check (confidence is null or confidence between 0 and 1);

create index if not exists jhadina_token_actor_edges_actor_confidence_idx
  on public.jhadina_token_actor_edges (actor_kind, actor_id, confidence desc);
