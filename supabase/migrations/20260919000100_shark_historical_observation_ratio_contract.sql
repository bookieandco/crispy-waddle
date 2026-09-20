-- SHARK-QA.15A: historical observation ratios are normalized to [0,1].
-- Legacy column names are retained for compatibility; constraints define semantics.
--
-- Compatibility repair:
-- Older SHARK revisions represented some "*_pct" observations on a 0..100 scale.
-- Normalize only values in (1,100]; values outside the recognized legacy domain
-- are left untouched so the constraint fails loudly instead of silently corrupting
-- unknown data.

update public.jhadina_launch_outcome_observations
set
  max_drawdown_pct = case
    when max_drawdown_pct > 1 and max_drawdown_pct <= 100 then max_drawdown_pct / 100
    else max_drawdown_pct
  end,
  liquidity_drawdown_from_peak = case
    when liquidity_drawdown_from_peak > 1 and liquidity_drawdown_from_peak <= 100 then liquidity_drawdown_from_peak / 100
    else liquidity_drawdown_from_peak
  end,
  holder_exit_pct = case
    when holder_exit_pct > 1 and holder_exit_pct <= 100 then holder_exit_pct / 100
    else holder_exit_pct
  end,
  developer_sold_pct = case
    when developer_sold_pct > 1 and developer_sold_pct <= 100 then developer_sold_pct / 100
    else developer_sold_pct
  end
where
  (max_drawdown_pct > 1 and max_drawdown_pct <= 100)
  or (liquidity_drawdown_from_peak > 1 and liquidity_drawdown_from_peak <= 100)
  or (holder_exit_pct > 1 and holder_exit_pct <= 100)
  or (developer_sold_pct > 1 and developer_sold_pct <= 100);

alter table public.jhadina_launch_outcome_observations
  drop constraint if exists jhadina_launch_outcome_observations_ratio_contract;

alter table public.jhadina_launch_outcome_observations
  add constraint jhadina_launch_outcome_observations_ratio_contract check (
    (max_drawdown_pct is null or max_drawdown_pct between 0 and 1)
    and (liquidity_drawdown_from_peak is null or liquidity_drawdown_from_peak between 0 and 1)
    and (holder_exit_pct is null or holder_exit_pct between 0 and 1)
    and (developer_sold_pct is null or developer_sold_pct between 0 and 1)
  );
