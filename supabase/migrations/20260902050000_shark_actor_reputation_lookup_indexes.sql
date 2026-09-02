create index if not exists jhadina_actor_outcome_history_actor_key_idx
  on public.jhadina_actor_outcome_history (actor_key);

create index if not exists jhadina_actor_outcome_history_kind_id_idx
  on public.jhadina_actor_outcome_history (actor_kind, actor_id);
