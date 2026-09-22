create index if not exists jhadina_side_hustle_experiment_observations_opportunity_idx
  on public.jhadina_side_hustle_experiment_observations (user_id, opportunity_id, observed_at);
