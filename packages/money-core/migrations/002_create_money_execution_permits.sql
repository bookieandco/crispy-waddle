CREATE TABLE IF NOT EXISTS money_execution_permits (
  permit_id TEXT PRIMARY KEY,
  nonce TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('ISSUED', 'CONSUMED', 'EXPIRED', 'REVOKED', 'HALTED')),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  action_fingerprint TEXT NOT NULL,
  user_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  provider TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  approval_id TEXT,
  opportunity_id TEXT,
  risk_decision_id TEXT,
  allocation_decision_id TEXT,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  halted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT money_execution_permits_expiry_check CHECK (expires_at > issued_at),
  CONSTRAINT money_execution_permits_state_timestamps_check CHECK (
    (state = 'ISSUED' AND consumed_at IS NULL AND revoked_at IS NULL AND halted_at IS NULL)
    OR (state = 'CONSUMED' AND consumed_at IS NOT NULL AND revoked_at IS NULL AND halted_at IS NULL)
    OR (state = 'EXPIRED' AND consumed_at IS NULL AND revoked_at IS NULL AND halted_at IS NULL)
    OR (state = 'REVOKED' AND revoked_at IS NOT NULL AND consumed_at IS NULL AND halted_at IS NULL)
    OR (state = 'HALTED' AND halted_at IS NOT NULL AND consumed_at IS NULL AND revoked_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_money_execution_permits_user_state
  ON money_execution_permits (user_id, state);

CREATE INDEX IF NOT EXISTS idx_money_execution_permits_expires_at
  ON money_execution_permits (expires_at);

CREATE INDEX IF NOT EXISTS idx_money_execution_permits_action_fingerprint
  ON money_execution_permits (action_fingerprint);
