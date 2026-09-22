-- MONEY-PROD.FINAL durable live runtime substrate.
-- Restores package migrations 010-013 to the live Supabase deployment path
-- and applies least-privilege service-role-only access.

CREATE TABLE IF NOT EXISTS money_broker_account_entitlements (
  entitlement_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  evidence_ids TEXT[] NOT NULL,
  provenance_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT money_broker_entitlement_expiry_check CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_money_broker_entitlement_lookup
  ON money_broker_account_entitlements(user_id,provider,account_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_money_broker_entitlement_active_unique
  ON money_broker_account_entitlements(user_id,provider,account_id)
  WHERE status='ACTIVE';

CREATE TABLE IF NOT EXISTS money_live_canary_state (
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  trading_date TEXT NOT NULL,
  currency TEXT NOT NULL,
  submitted_notional_minor BIGINT NOT NULL DEFAULT 0 CHECK (submitted_notional_minor >= 0),
  submitted_orders INTEGER NOT NULL DEFAULT 0 CHECK (submitted_orders >= 0),
  realized_loss_minor BIGINT NOT NULL DEFAULT 0 CHECK (realized_loss_minor >= 0),
  gross_exposure_minor BIGINT NOT NULL DEFAULT 0 CHECK (gross_exposure_minor >= 0),
  unresolved_execution_ids TEXT[] NOT NULL DEFAULT '{}',
  risk_metric_observed_at TIMESTAMPTZ,
  risk_metric_evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  halted BOOLEAN NOT NULL DEFAULT FALSE,
  halt_reason TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(provider,account_id,trading_date)
);
CREATE TABLE IF NOT EXISTS money_live_canary_reservations (
  reservation_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  trading_date TEXT NOT NULL,
  notional_minor BIGINT NOT NULL CHECK (notional_minor > 0),
  side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
  state_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RESERVED','RELEASED')),
  created_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  FOREIGN KEY(provider,account_id,trading_date)
    REFERENCES money_live_canary_state(provider,account_id,trading_date)
);
CREATE INDEX IF NOT EXISTS idx_money_live_canary_unresolved
  ON money_live_canary_state(provider,account_id,trading_date)
  WHERE cardinality(unresolved_execution_ids)>0;

CREATE TABLE IF NOT EXISTS money_provider_execution_events (
  event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CLAIMED','PROCESSED')),
  event_json JSONB NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  result_json JSONB,
  UNIQUE(provider,provider_event_id)
);
CREATE TABLE IF NOT EXISTS money_execution_outbox (
  outbox_id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','DELIVERED')),
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_money_provider_events_status
  ON money_provider_execution_events(status,claimed_at);
CREATE INDEX IF NOT EXISTS idx_money_execution_outbox_pending
  ON money_execution_outbox(status,created_at)
  WHERE status='PENDING';

CREATE TABLE IF NOT EXISTS money_paper_execution_events (
  event_id TEXT PRIMARY KEY,
  paper_run_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ORDER','FILL','PORTFOLIO_SNAPSHOT','OUTCOME','STRATEGY_RESULT')),
  occurred_at TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_money_paper_events_run_time
  ON money_paper_execution_events(paper_run_id,occurred_at,event_id);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_broker_account_entitlements',
    'money_live_canary_state',
    'money_live_canary_reservations',
    'money_provider_execution_events',
    'money_execution_outbox',
    'money_paper_execution_events'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON money_broker_account_entitlements TO service_role;
GRANT SELECT, INSERT, UPDATE ON money_live_canary_state TO service_role;
GRANT SELECT, INSERT, UPDATE ON money_live_canary_reservations TO service_role;
GRANT SELECT, INSERT, UPDATE ON money_provider_execution_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON money_execution_outbox TO service_role;
GRANT SELECT, INSERT ON money_paper_execution_events TO service_role;

DROP POLICY IF EXISTS money_broker_entitlements_service_role_only ON money_broker_account_entitlements;
CREATE POLICY money_broker_entitlements_service_role_only
  ON money_broker_account_entitlements FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_live_canary_state_service_role_only ON money_live_canary_state;
CREATE POLICY money_live_canary_state_service_role_only
  ON money_live_canary_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_live_canary_reservations_service_role_only ON money_live_canary_reservations;
CREATE POLICY money_live_canary_reservations_service_role_only
  ON money_live_canary_reservations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_provider_events_service_role_only ON money_provider_execution_events;
CREATE POLICY money_provider_events_service_role_only
  ON money_provider_execution_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_execution_outbox_service_role_only ON money_execution_outbox;
CREATE POLICY money_execution_outbox_service_role_only
  ON money_execution_outbox FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_paper_events_service_role_only ON money_paper_execution_events;
CREATE POLICY money_paper_events_service_role_only
  ON money_paper_execution_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE money_broker_account_entitlements IS
  'Durable broker capability entitlements. Contains evidence/provenance, not broker credentials.';
COMMENT ON TABLE money_live_canary_state IS
  'Durable bounded live-canary risk state and kill-switch state.';
COMMENT ON TABLE money_live_canary_reservations IS
  'Durable atomic reservations against live-canary limits.';
COMMENT ON TABLE money_provider_execution_events IS
  'Durable provider-event replay and conflict-detection ledger.';
COMMENT ON TABLE money_execution_outbox IS
  'Durable execution projection outbox.';
COMMENT ON TABLE money_paper_execution_events IS
  'Durable simulation-only paper execution and learning ledger.';
