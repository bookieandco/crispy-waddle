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
  result_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, payment_id)
);

ALTER TABLE jhadina_commerce_payment_operation ADD COLUMN IF NOT EXISTS result_payload JSONB;
CREATE INDEX IF NOT EXISTS idx_jhadina_commerce_payment_operation_actor ON jhadina_commerce_payment_operation (actor_id, created_at DESC);
ALTER TABLE jhadina_commerce_payment_operation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jhadina_commerce_payment_operation_owner_select ON jhadina_commerce_payment_operation;
CREATE POLICY jhadina_commerce_payment_operation_owner_select ON jhadina_commerce_payment_operation FOR SELECT USING (auth.uid() = actor_id);
REVOKE ALL ON jhadina_commerce_payment_operation FROM anon;
REVOKE ALL ON jhadina_commerce_payment_operation FROM authenticated;

CREATE OR REPLACE FUNCTION claim_jhadina_commerce_payment_operation(
  p_provider TEXT, p_payment_id TEXT, p_actor_id UUID, p_action_id TEXT,
  p_capability TEXT, p_request_fingerprint TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jhadina_commerce_payment_operation; inserted BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN RAISE EXCEPTION 'ACTOR_BINDING_FAILED'; END IF;
  INSERT INTO jhadina_commerce_payment_operation
    (provider, payment_id, actor_id, action_id, capability, request_fingerprint, status)
  VALUES (p_provider, p_payment_id, p_actor_id, p_action_id, p_capability, p_request_fingerprint, 'processing')
  ON CONFLICT (provider, payment_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  SELECT * INTO r FROM jhadina_commerce_payment_operation WHERE provider = p_provider AND payment_id = p_payment_id;
  IF r.actor_id <> p_actor_id OR r.action_id <> p_action_id OR r.capability <> p_capability OR r.request_fingerprint <> p_request_fingerprint THEN
    RAISE EXCEPTION 'PAYMENT_OPERATION_BINDING_MISMATCH';
  END IF;
  RETURN jsonb_build_object('claimed', inserted, 'record', to_jsonb(r));
END; $$;

CREATE OR REPLACE FUNCTION complete_jhadina_commerce_payment_operation(
  p_provider TEXT, p_payment_id TEXT, p_actor_id UUID, p_action_id TEXT,
  p_capability TEXT, p_request_fingerprint TEXT, p_provider_reference TEXT,
  p_result_status TEXT, p_result_payload JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN RAISE EXCEPTION 'ACTOR_BINDING_FAILED'; END IF;
  UPDATE jhadina_commerce_payment_operation
  SET status='completed', provider_reference=p_provider_reference, result_status=p_result_status,
      result_payload=p_result_payload, completed_at=CURRENT_TIMESTAMP
  WHERE provider=p_provider AND payment_id=p_payment_id AND actor_id=p_actor_id
    AND action_id=p_action_id AND capability=p_capability AND request_fingerprint=p_request_fingerprint
    AND status='processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_OPERATION_NOT_PROCESSING_OR_BINDING_MISMATCH'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION fail_jhadina_commerce_payment_operation(
  p_provider TEXT, p_payment_id TEXT, p_actor_id UUID, p_action_id TEXT,
  p_capability TEXT, p_request_fingerprint TEXT, p_provider_reference TEXT,
  p_result_status TEXT, p_result_payload JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN RAISE EXCEPTION 'ACTOR_BINDING_FAILED'; END IF;
  UPDATE jhadina_commerce_payment_operation
  SET status='failed', provider_reference=p_provider_reference, result_status=p_result_status,
      result_payload=p_result_payload, completed_at=CURRENT_TIMESTAMP
  WHERE provider=p_provider AND payment_id=p_payment_id AND actor_id=p_actor_id
    AND action_id=p_action_id AND capability=p_capability AND request_fingerprint=p_request_fingerprint
    AND status='processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_OPERATION_NOT_PROCESSING_OR_BINDING_MISMATCH'; END IF;
END; $$;

REVOKE ALL ON FUNCTION claim_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fail_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
