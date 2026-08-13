CREATE TABLE IF NOT EXISTS money_transaction_requests (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
  provider_reference TEXT,
  result_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_money_transaction_requests_user_id
  ON money_transaction_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_money_transaction_requests_status
  ON money_transaction_requests (status);

CREATE INDEX IF NOT EXISTS idx_money_transaction_requests_created_at
  ON money_transaction_requests (created_at);

ALTER TABLE money_transaction_requests
  ADD CONSTRAINT money_transaction_requests_completed_result_check
  CHECK (
    (status = 'processing' AND completed_at IS NULL)
    OR
    (status = 'completed' AND completed_at IS NOT NULL
      AND provider_reference IS NOT NULL
      AND result_status IS NOT NULL)
  );
