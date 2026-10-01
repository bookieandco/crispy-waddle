-- JHADINA-PURSE.1 through PURSE-REBALANCER.FINAL durable evidence substrate.
-- The Purse is an allocation/intelligence layer. These tables cannot execute trades,
-- place wagers, sign transactions, or move money. Downstream Money executors retain authority.

CREATE TABLE IF NOT EXISTS public.money_purse_charters (
  charter_id TEXT PRIMARY KEY,
  charter_version TEXT NOT NULL,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  reporting_currency TEXT NOT NULL,
  autonomy_mode TEXT NOT NULL CHECK (autonomy_mode IN ('ADVISORY','PAPER_AUTONOMOUS','SHADOW_AUTONOMOUS','LIVE_GOVERNED_INTENTS')),
  verified_owner_payout_destination_id TEXT NOT NULL,
  config_json JSONB NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'OWNER_TREASURY_CHARTER' CHECK (authority='OWNER_TREASURY_CHARTER'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at IS NULL OR expires_at > effective_at)
);

CREATE TABLE IF NOT EXISTS public.money_purse_opportunity_events (
  bus_event_id TEXT PRIMARY KEY,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('MEME','CRYPTO','SPORTS','STOCK','FOREX','PREDICTION','METALS')),
  strategy_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  admitted BOOLEAN NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  opportunity_json JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'OPPORTUNITY_BUS_ONLY' CHECK (authority='OPPORTUNITY_BUS_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.money_purse_allocation_plans (
  plan_id TEXT PRIMARY KEY,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  reporting_currency TEXT NOT NULL,
  total_portfolio_value_minor BIGINT NOT NULL CHECK (total_portfolio_value_minor >= 0),
  protected_reserve_minor BIGINT NOT NULL CHECK (protected_reserve_minor >= 0),
  maximum_deployable_minor BIGINT NOT NULL CHECK (maximum_deployable_minor >= 0),
  current_exposure_minor BIGINT NOT NULL CHECK (current_exposure_minor >= 0),
  incremental_capacity_minor BIGINT NOT NULL CHECK (incremental_capacity_minor >= 0),
  allocated_increment_minor BIGINT NOT NULL CHECK (allocated_increment_minor >= 0),
  unallocated_liquidity_minor BIGINT NOT NULL CHECK (unallocated_liquidity_minor >= 0),
  targets_json JSONB NOT NULL,
  learning_profile_ids TEXT[] NOT NULL DEFAULT '{}',
  decision_style_id TEXT,
  rejected_opportunity_ids TEXT[] NOT NULL DEFAULT '{}',
  information_cutoff TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'PURSE_ALLOCATION_ONLY' CHECK (authority='PURSE_ALLOCATION_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  requires_downstream_risk_and_authority BOOLEAN NOT NULL DEFAULT TRUE CHECK (requires_downstream_risk_and_authority=TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > information_cutoff),
  CHECK (allocated_increment_minor <= incremental_capacity_minor)
);

CREATE TABLE IF NOT EXISTS public.money_purse_learning_events (
  learning_event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('PAPER_STRATEGY','SHARK_CLOSED_TRADE','PURSE_OUTCOME','PERSONALITY_STYLE','STRATEGY_PROFILE')),
  lane TEXT CHECK (lane IS NULL OR lane IN ('MEME','CRYPTO','SPORTS','STOCK','FOREX','PREDICTION','METALS')),
  strategy_id TEXT,
  instrument_id TEXT,
  payload_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'LEARNING_ONLY' CHECK (authority='LEARNING_ONLY'),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS money_purse_learning_user_time_idx
  ON public.money_purse_learning_events(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS money_purse_learning_strategy_time_idx
  ON public.money_purse_learning_events(user_id, lane, strategy_id, observed_at DESC)
  WHERE strategy_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.money_purse_decision_sets (
  decision_set_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES public.money_purse_allocation_plans(plan_id),
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  allocations_json JSONB NOT NULL,
  cash_decision_json JSONB NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'PURSE_DECISION_SET_ONLY' CHECK (authority='PURSE_DECISION_SET_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.money_purse_portfolio_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  reporting_currency TEXT NOT NULL,
  total_account_value_minor BIGINT NOT NULL CHECK (total_account_value_minor >= 0),
  total_position_value_minor BIGINT NOT NULL CHECK (total_position_value_minor >= 0),
  gross_portfolio_value_minor BIGINT NOT NULL CHECK (gross_portfolio_value_minor >= 0),
  liquid_account_value_minor BIGINT NOT NULL CHECK (liquid_account_value_minor >= 0),
  executable_position_value_minor BIGINT NOT NULL CHECK (executable_position_value_minor >= 0),
  unsettled_minor BIGINT NOT NULL CHECK (unsettled_minor >= 0),
  reserved_minor BIGINT NOT NULL CHECK (reserved_minor >= 0),
  realized_pnl_minor BIGINT NOT NULL,
  unrealized_pnl_minor BIGINT NOT NULL,
  accounts_json JSONB NOT NULL,
  positions_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'PORTFOLIO_EVIDENCE' CHECK (authority='PORTFOLIO_EVIDENCE'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.money_purse_liquidity_snapshots (
  liquidity_snapshot_id TEXT PRIMARY KEY,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  portfolio_snapshot_id TEXT NOT NULL REFERENCES public.money_purse_portfolio_snapshots(snapshot_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  reporting_currency TEXT NOT NULL,
  gross_liquid_minor BIGINT NOT NULL CHECK (gross_liquid_minor >= 0),
  unsettled_minor BIGINT NOT NULL CHECK (unsettled_minor >= 0),
  account_reserved_minor BIGINT NOT NULL CHECK (account_reserved_minor >= 0),
  charter_protected_reserve_minor BIGINT NOT NULL CHECK (charter_protected_reserve_minor >= 0),
  external_obligations_minor BIGINT NOT NULL CHECK (external_obligations_minor >= 0),
  available_to_allocate_minor BIGINT NOT NULL CHECK (available_to_allocate_minor >= 0),
  available_for_withdrawal_minor BIGINT NOT NULL CHECK (available_for_withdrawal_minor >= 0),
  executable_exit_value_minor BIGINT NOT NULL CHECK (executable_exit_value_minor >= 0),
  owner_sweep_hold_minor BIGINT NOT NULL CHECK (owner_sweep_hold_minor >= 0),
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'LIQUIDITY_EVIDENCE' CHECK (authority='LIQUIDITY_EVIDENCE'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.money_purse_rebalance_plans (
  rebalance_plan_id TEXT PRIMARY KEY,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  decision_set_id TEXT NOT NULL REFERENCES public.money_purse_decision_sets(decision_set_id),
  portfolio_snapshot_id TEXT NOT NULL REFERENCES public.money_purse_portfolio_snapshots(snapshot_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  reporting_currency TEXT NOT NULL,
  turnover_minor BIGINT NOT NULL CHECK (turnover_minor >= 0),
  turnover_bps INTEGER NOT NULL CHECK (turnover_bps BETWEEN 0 AND 10000),
  cash_target_minor BIGINT NOT NULL CHECK (cash_target_minor >= 0),
  intents_json JSONB NOT NULL,
  created_at_evidence TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'PURSE_REBALANCE_PLAN_ONLY' CHECK (authority='PURSE_REBALANCE_PLAN_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  requires_downstream_risk_and_authority BOOLEAN NOT NULL DEFAULT TRUE CHECK (requires_downstream_risk_and_authority=TRUE),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > created_at_evidence)
);

CREATE INDEX IF NOT EXISTS money_purse_opportunity_user_time_idx ON public.money_purse_opportunity_events(user_id,ingested_at DESC);
CREATE INDEX IF NOT EXISTS money_purse_allocation_user_time_idx ON public.money_purse_allocation_plans(user_id,information_cutoff DESC);
CREATE INDEX IF NOT EXISTS money_purse_portfolio_user_time_idx ON public.money_purse_portfolio_snapshots(user_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS money_purse_liquidity_user_time_idx ON public.money_purse_liquidity_snapshots(user_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS money_purse_rebalance_user_time_idx ON public.money_purse_rebalance_plans(user_id,created_at_evidence DESC);

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'money_purse_charters',
  'money_purse_opportunity_events',
  'money_purse_allocation_plans',
  'money_purse_learning_events',
  'money_purse_decision_sets',
  'money_purse_portfolio_snapshots',
  'money_purse_liquidity_snapshots',
  'money_purse_rebalance_plans'
 ]
 LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO service_role',t);
 END LOOP;
END $$;

COMMENT ON TABLE public.money_purse_charters IS 'Append-only owner treasury charter versions. Jhadina cannot mutate her own financial authority.';
COMMENT ON TABLE public.money_purse_opportunity_events IS 'Normalized cross-domain purse opportunity admission evidence; no execution authority.';
COMMENT ON TABLE public.money_purse_allocation_plans IS 'Charter-bounded cross-lane capital allocation plans with explicit learning/personality lineage; downstream risk and authority remain mandatory.';
COMMENT ON TABLE public.money_purse_learning_events IS 'Append-only paper, SHARK, Purse-outcome, strategy-profile and personality-style learning evidence. It can never authorize live financial mutation.';
COMMENT ON TABLE public.money_purse_decision_sets IS 'Durable where-and-why capital decision evidence.';
COMMENT ON TABLE public.money_purse_portfolio_snapshots IS 'Unified purse account/holding evidence. Cash/non-position account value and holdings are stored separately to avoid double counting.';
COMMENT ON TABLE public.money_purse_liquidity_snapshots IS 'Spendable-liquidity truth excluding unsettled, reserved, protected and owner-sweep-held capital.';
COMMENT ON TABLE public.money_purse_rebalance_plans IS 'Non-executing rebalance intent plans. Lane-specific governed executors retain all financial side-effect authority.';
