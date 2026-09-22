-- SHARK-CONVERGE.8: close legacy Data API grants on the private SHARK persistence plane.
-- jhadina_token_launches is intentionally excluded because it is a shared owner-scoped registry.

do $$
declare
  t text;
begin
  foreach t in array array[
    'jhadina_token_actor_edges',
    'jhadina_launch_outcome_observations',
    'jhadina_actor_outcome_history',
    'jhadina_launch_outcome_evaluations',
    'jhadina_shark_historical_backfill_schedule',
    'jhadina_shark_wallet_intelligence_quota',
    'jhadina_shark_wallet_cluster_calibration_observations',
    'jhadina_shark_meteora_cash_flow_evidence',
    'jhadina_shark_meteora_position_state_evidence'
  ]
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end
$$;

grant select, insert, update, delete
  on public.jhadina_token_actor_edges,
     public.jhadina_launch_outcome_observations,
     public.jhadina_actor_outcome_history,
     public.jhadina_launch_outcome_evaluations,
     public.jhadina_shark_historical_backfill_schedule,
     public.jhadina_shark_wallet_intelligence_quota
  to service_role;

grant select, insert
  on public.jhadina_shark_wallet_cluster_calibration_observations,
     public.jhadina_shark_meteora_cash_flow_evidence,
     public.jhadina_shark_meteora_position_state_evidence
  to service_role;

revoke update, delete
  on public.jhadina_shark_wallet_cluster_calibration_observations,
     public.jhadina_shark_meteora_cash_flow_evidence,
     public.jhadina_shark_meteora_position_state_evidence
  from service_role;
