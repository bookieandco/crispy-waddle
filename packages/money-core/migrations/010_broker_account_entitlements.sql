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
