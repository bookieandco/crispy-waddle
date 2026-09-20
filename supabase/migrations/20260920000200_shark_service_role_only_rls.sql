-- SHARK-QA.16B: SHARK intelligence persistence is an internal/server boundary.
-- Service-role workers bypass RLS; browser/authenticated clients must use governed
-- server routes rather than reading raw launch, actor, outcome, or evidence tables.

drop policy if exists jhadina_token_launches_select_authenticated
  on public.jhadina_token_launches;

drop policy if exists jhadina_token_actor_edges_select_authenticated
  on public.jhadina_token_actor_edges;

drop policy if exists jhadina_launch_outcome_observations_select_authenticated
  on public.jhadina_launch_outcome_observations;

drop policy if exists jhadina_actor_outcome_history_select_authenticated
  on public.jhadina_actor_outcome_history;

drop policy if exists jhadina_launch_outcome_evaluations_select_authenticated
  on public.jhadina_launch_outcome_evaluations;

-- RLS remains enabled. No anon/authenticated read or write policy is recreated.
-- The Supabase service role is intentionally the only persistence-plane access path.
