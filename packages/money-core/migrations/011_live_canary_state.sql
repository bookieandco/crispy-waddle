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
  FOREIGN KEY(provider,account_id,trading_date) REFERENCES money_live_canary_state(provider,account_id,trading_date)
);
CREATE INDEX IF NOT EXISTS idx_money_live_canary_unresolved ON money_live_canary_state(provider,account_id,trading_date) WHERE cardinality(unresolved_execution_ids)>0;
