-- MONEY-PAPER-LOOP.1 durable paper learning, watchlist, and autopilot state.
-- Paper learning is append-only. User configuration remains service-role mediated.
-- None of these tables grants live trading authority.

CREATE TABLE IF NOT EXISTS money_paper_learning_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  paper_run_id TEXT,
  strategy_id TEXT,
  instrument_id TEXT,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'DECISION',
      'RESOLUTION',
      'DECISION_LEARNING',
      'STRATEGY_LEARNING',
      'CALIBRATION',
      'REVIEW',
      'AUTOPILOT'
    )
  ),
  occurred_at TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_money_paper_learning_user_time
  ON money_paper_learning_events(user_id, occurred_at DESC, event_id DESC);
CREATE INDEX IF NOT EXISTS idx_money_paper_learning_strategy_time
  ON money_paper_learning_events(user_id, strategy_id, occurred_at DESC)
  WHERE strategy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_money_paper_learning_run
  ON money_paper_learning_events(paper_run_id, occurred_at)
  WHERE paper_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS money_stock_watchlist_entries (
  entry_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL CHECK (symbol ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  UNIQUE(user_id, symbol),
  CHECK (updated_at >= added_at)
);

CREATE INDEX IF NOT EXISTS idx_money_stock_watchlist_user
  ON money_stock_watchlist_entries(user_id, enabled, symbol);

CREATE TABLE IF NOT EXISTS money_stock_alerts (
  alert_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL CHECK (symbol ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  condition TEXT NOT NULL CHECK (
    condition IN ('ABOVE','BELOW','MOVE_FROM_REFERENCE_BPS')
  ),
  threshold NUMERIC NOT NULL CHECK (threshold > 0),
  reference_price NUMERIC,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  repeat BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  CHECK (
    condition <> 'MOVE_FROM_REFERENCE_BPS'
    OR (reference_price IS NOT NULL AND reference_price > 0)
  ),
  CHECK (updated_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_money_stock_alerts_user_symbol
  ON money_stock_alerts(user_id, symbol, enabled);

CREATE TABLE IF NOT EXISTS money_paper_autopilot_settings (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'alpaca'),
  account_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (
    mode IN (
      'OFF',
      'OBSERVE',
      'ADVISE',
      'PAPER_AUTO_REDUCED',
      'PAPER_AUTO',
      'HALT'
    )
  ),
  stock_feed TEXT NOT NULL CHECK (stock_feed IN ('iex','sip','delayed_sip')),
  strategy_id TEXT NOT NULL,
  base_order_notional_minor BIGINT NOT NULL CHECK (base_order_notional_minor > 0),
  max_order_notional_minor BIGINT NOT NULL CHECK (max_order_notional_minor > 0),
  maximum_concurrent_positions INTEGER NOT NULL CHECK (
    maximum_concurrent_positions BETWEEN 1 AND 100
  ),
  risk_fraction_bps INTEGER NOT NULL CHECK (risk_fraction_bps BETWEEN 1 AND 200),
  stop_loss_bps INTEGER NOT NULL CHECK (stop_loss_bps BETWEEN 1 AND 5000),
  take_profit_bps INTEGER NOT NULL CHECK (take_profit_bps BETWEEN 1 AND 10000),
  allow_opening_shorts BOOLEAN NOT NULL DEFAULT FALSE CHECK (allow_opening_shorts = FALSE),
  updated_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  PRIMARY KEY(user_id, provider, account_id),
  CHECK (base_order_notional_minor <= max_order_notional_minor)
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_paper_learning_events',
    'money_stock_watchlist_entries',
    'money_stock_alerts',
    'money_paper_autopilot_settings'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM service_role', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT ON money_paper_learning_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON money_stock_watchlist_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON money_stock_alerts TO service_role;
GRANT SELECT, INSERT, UPDATE ON money_paper_autopilot_settings TO service_role;

DROP POLICY IF EXISTS money_paper_learning_service_role_only ON money_paper_learning_events;
CREATE POLICY money_paper_learning_service_role_only
  ON money_paper_learning_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_stock_watchlist_service_role_only ON money_stock_watchlist_entries;
CREATE POLICY money_stock_watchlist_service_role_only
  ON money_stock_watchlist_entries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_stock_alerts_service_role_only ON money_stock_alerts;
CREATE POLICY money_stock_alerts_service_role_only
  ON money_stock_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_paper_autopilot_settings_service_role_only ON money_paper_autopilot_settings;
CREATE POLICY money_paper_autopilot_settings_service_role_only
  ON money_paper_autopilot_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE money_paper_learning_events IS
  'Append-only paper decision, outcome, calibration, and autopilot learning records. Never live authority.';
COMMENT ON TABLE money_stock_watchlist_entries IS
  'User-scoped stock watchlist configuration. Attention only; never trade authority.';
COMMENT ON TABLE money_stock_alerts IS
  'User-scoped deterministic stock alert configuration. Attention only; never trade authority.';
COMMENT ON TABLE money_paper_autopilot_settings IS
  'User-scoped paper-only automation settings. Cannot enable or configure live autonomous trading.';
