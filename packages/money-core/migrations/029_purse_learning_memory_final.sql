-- PURSE-LEARNING-MEMORY.FINAL
-- Durable evidence-only learning memory for Jhadina's Purse.
-- No table in this migration grants trading, betting, transfer, conversion,
-- signing, withdrawal, or deposit authority.

CREATE TABLE IF NOT EXISTS public.money_purse_learning_episodes (
  episode_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('MONEY_PAPER','SHARK','SPORTS','SHADOW','SIMULATION')),
  source_record_id TEXT NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('MEME','CRYPTO','SPORTS','STOCK','FOREX','PREDICTION','METALS')),
  strategy_id TEXT NOT NULL,
  instrument_id TEXT,
  scenario_id TEXT,
  return_bps INTEGER NOT NULL,
  decision_quality_bps INTEGER NOT NULL CHECK (decision_quality_bps BETWEEN 0 AND 10000),
  execution_quality_bps INTEGER NOT NULL CHECK (execution_quality_bps BETWEEN 0 AND 10000),
  downside_occurred BOOLEAN NOT NULL,
  thesis_disposition TEXT NOT NULL CHECK (thesis_disposition IN ('SUPPORTED','MIXED','INVALIDATED','UNKNOWN')),
  sizing_diagnosis TEXT NOT NULL CHECK (sizing_diagnosis IN ('UNDER_SIZED','APPROPRIATE','OVER_SIZED','UNKNOWN')),
  lesson_tags TEXT[] NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'PURSE_LEARNING_ONLY' CHECK (authority='PURSE_LEARNING_ONLY'),
  financial_authority TEXT NOT NULL DEFAULT 'NONE' CHECK (financial_authority='NONE'),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,source,source_record_id)
);

CREATE TABLE IF NOT EXISTS public.money_purse_learning_profiles (
  profile_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  lane TEXT NOT NULL CHECK (lane IN ('MEME','CRYPTO','SPORTS','STOCK','FOREX','PREDICTION','METALS')),
  strategy_id TEXT NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  mean_return_bps INTEGER NOT NULL,
  win_rate_bps INTEGER NOT NULL CHECK (win_rate_bps BETWEEN 0 AND 10000),
  downside_rate_bps INTEGER NOT NULL CHECK (downside_rate_bps BETWEEN 0 AND 10000),
  mean_decision_quality_bps INTEGER NOT NULL CHECK (mean_decision_quality_bps BETWEEN 0 AND 10000),
  mean_execution_quality_bps INTEGER NOT NULL CHECK (mean_execution_quality_bps BETWEEN 0 AND 10000),
  supported_thesis_rate_bps INTEGER NOT NULL CHECK (supported_thesis_rate_bps BETWEEN 0 AND 10000),
  invalidated_thesis_rate_bps INTEGER NOT NULL CHECK (invalidated_thesis_rate_bps BETWEEN 0 AND 10000),
  evidence_strength_bps INTEGER NOT NULL CHECK (evidence_strength_bps BETWEEN 0 AND 10000),
  confidence_adjustment_bps INTEGER NOT NULL CHECK (confidence_adjustment_bps BETWEEN -2500 AND 1000),
  sizing_multiplier_bps INTEGER NOT NULL CHECK (sizing_multiplier_bps BETWEEN 2500 AND 10000),
  disposition TEXT NOT NULL CHECK (disposition IN ('INSUFFICIENT_EVIDENCE','SUPPORTED','MIXED','REJECTED')),
  lesson_tags TEXT[] NOT NULL DEFAULT '{}',
  episode_ids TEXT[] NOT NULL DEFAULT '{}',
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  calibrated_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'PURSE_LEARNING_PROFILE_ONLY' CHECK (authority='PURSE_LEARNING_PROFILE_ONLY'),
  financial_authority TEXT NOT NULL DEFAULT 'NONE' CHECK (financial_authority='NONE'),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.money_purse_financial_temperaments (
  temperament_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  personality_version INTEGER NOT NULL CHECK (personality_version >= 0),
  cash_patience_bps INTEGER NOT NULL CHECK (cash_patience_bps BETWEEN 0 AND 10000),
  evidence_discipline_bps INTEGER NOT NULL CHECK (evidence_discipline_bps BETWEEN 0 AND 10000),
  exploration_bps INTEGER NOT NULL CHECK (exploration_bps BETWEEN 0 AND 10000),
  loss_sensitivity_bps INTEGER NOT NULL CHECK (loss_sensitivity_bps BETWEEN 0 AND 10000),
  independent_assessment_required BOOLEAN NOT NULL,
  live_personality_risk_boost_allowed BOOLEAN NOT NULL DEFAULT FALSE CHECK (live_personality_risk_boost_allowed=FALSE),
  paper_exploration_only BOOLEAN NOT NULL DEFAULT TRUE CHECK (paper_exploration_only=TRUE),
  explanation_style TEXT NOT NULL CHECK (explanation_style IN ('EVIDENCE_FIRST','BALANCED','EXPLORATORY')),
  derived_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'PURSE_TEMPERAMENT_ONLY' CHECK (authority='PURSE_TEMPERAMENT_ONLY'),
  financial_authority TEXT NOT NULL DEFAULT 'NONE' CHECK (financial_authority='NONE'),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS money_purse_learning_episode_strategy_idx
  ON public.money_purse_learning_episodes(user_id,lane,strategy_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS money_purse_learning_profile_strategy_idx
  ON public.money_purse_learning_profiles(user_id,lane,strategy_id,calibrated_at DESC);
CREATE INDEX IF NOT EXISTS money_purse_temperament_time_idx
  ON public.money_purse_financial_temperaments(user_id,derived_at DESC);

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'money_purse_learning_episodes',
  'money_purse_learning_profiles',
  'money_purse_financial_temperaments'
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

COMMENT ON TABLE public.money_purse_learning_episodes IS 'Append-only normalized learning from Money paper/shadow, SHARK and Sports. Evidence only; no financial authority.';
COMMENT ON TABLE public.money_purse_learning_profiles IS 'Append-only strategy calibration used by the Purse to adjust confidence/ranking/sizing without increasing charter limits.';
COMMENT ON TABLE public.money_purse_financial_temperaments IS 'Append-only financial decision temperament derived from governed personality plus outcome memory; never a live risk-authority grant.';
