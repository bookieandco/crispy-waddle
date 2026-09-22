CREATE TABLE IF NOT EXISTS money_autonomous_trading_mandates (
  mandate_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode = 'LIVE_AUTONOMOUS'),
  allowed_instrument_prefixes TEXT[] NOT NULL CHECK (cardinality(allowed_instrument_prefixes) > 0),
  allowed_strategy_ids TEXT[] NOT NULL CHECK (cardinality(allowed_strategy_ids) > 0),
  allow_opening_shorts BOOLEAN NOT NULL DEFAULT FALSE,
  max_order_notional_minor BIGINT NOT NULL CHECK (max_order_notional_minor > 0),
  max_daily_submitted_notional_minor BIGINT NOT NULL CHECK (max_daily_submitted_notional_minor > 0),
  max_daily_orders INTEGER NOT NULL CHECK (max_daily_orders > 0),
  max_daily_realized_loss_minor BIGINT NOT NULL CHECK (max_daily_realized_loss_minor > 0),
  max_gross_exposure_minor BIGINT NOT NULL CHECK (max_gross_exposure_minor > 0),
  max_drawdown_bps INTEGER NOT NULL CHECK (max_drawdown_bps BETWEEN 0 AND 10000),
  max_leverage_bps INTEGER NOT NULL CHECK (max_leverage_bps BETWEEN 10000 AND 100000),
  min_model_confidence_bps INTEGER NOT NULL CHECK (min_model_confidence_bps BETWEEN 0 AND 10000),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  approval_receipt_id TEXT NOT NULL,
  action_core_authority_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
  activated_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > starts_at),
  CHECK (max_order_notional_minor <= max_daily_submitted_notional_minor),
  CHECK (max_order_notional_minor <= max_gross_exposure_minor)
);

CREATE INDEX IF NOT EXISTS money_auto_mandate_active_lookup
ON money_autonomous_trading_mandates(user_id, provider, account_id, status, expires_at);

REVOKE ALL ON money_autonomous_trading_mandates FROM PUBLIC;
REVOKE ALL ON money_autonomous_trading_mandates FROM anon;
REVOKE ALL ON money_autonomous_trading_mandates FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON money_autonomous_trading_mandates TO service_role;

ALTER TABLE money_autonomous_trading_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_autonomous_trading_mandates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_auto_service_role_only ON money_autonomous_trading_mandates;
CREATE POLICY money_auto_service_role_only
ON money_autonomous_trading_mandates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE money_autonomous_trading_mandates IS
'User-approved bounded autonomous trading mandates. Service-role only; model output cannot mutate mandate limits.';
