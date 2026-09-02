CREATE TABLE IF NOT EXISTS jhadina_commerce_payment_operation (
  provider TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  actor_id UUID NOT NULL,
  action_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  provider_reference TEXT,
  result_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, payment_id)
);

CREATE INDEX IF NOT EXISTS idx_jhadina_commerce_payment_operation_actor
  ON jhadina_commerce_payment_operation (actor_id, created_at DESC);

ALTER TABLE jhadina_commerce_payment_operation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jhadina_commerce_payment_operation_owner_select
  ON jhadina_commerce_payment_operation;
CREATE POLICY jhadina_commerce_payment_operation_owner_select
  ON jhadina_commerce_payment_operation
  FOR SELECT
  USING (auth.uid() = actor_id);

REVOKE ALL ON jhadina_commerce_payment_operation FROM anon;
REVOKE ALL ON jhadina_commerce_payment_operation FROM authenticated;

COMMENT ON TABLE jhadina_commerce_payment_operation IS
  'Durable Commerce payment execution/idempotency record. Provider/payment_id is the external operation identity; approval remains enforced at the governed provider boundary.';
