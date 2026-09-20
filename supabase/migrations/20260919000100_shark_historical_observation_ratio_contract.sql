-- SHARK-QA.15A: historical observation ratios are normalized to [0,1].
-- Legacy column names are retained for compatibility; constraints define semantics.
alter table public.jhadina_launch_outcome_observations
  drop constraint if exists jhadina_launch_outcome_observations_ratio_contract;

alter table public.jhadina_launch_outcome_observations
  add constraint jhadina_launch_outcome_observations_ratio_contract check (
    (max_drawdown_pct is null or max_drawdown_pct between 0 and 1)
    and (liquidity_drawdown_from_peak is null or liquidity_drawdown_from_peak between 0 and 1)
    and (holder_exit_pct is null or holder_exit_pct between 0 and 1)
    and (developer_sold_pct is null or developer_sold_pct between 0 and 1)
  );
