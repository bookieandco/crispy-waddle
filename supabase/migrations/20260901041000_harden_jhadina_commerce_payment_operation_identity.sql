ALTER TABLE jhadina_commerce_payment_operation
  ADD COLUMN IF NOT EXISTS operation_id TEXT;

UPDATE jhadina_commerce_payment_operation
SET operation_id = payment_id
WHERE operation_id IS NULL;

ALTER TABLE jhadina_commerce_payment_operation
  ALTER COLUMN operation_id SET NOT NULL;

ALTER TABLE jhadina_commerce_payment_operation
  DROP CONSTRAINT IF EXISTS jhadina_commerce_payment_operation_pkey;

ALTER TABLE jhadina_commerce_payment_operation
  ADD CONSTRAINT jhadina_commerce_payment_operation_pkey PRIMARY KEY (provider, operation_id);

CREATE INDEX IF NOT EXISTS idx_jhadina_commerce_payment_operation_payment
  ON jhadina_commerce_payment_operation (provider, payment_id);

CREATE OR REPLACE FUNCTION claim_jhadina_commerce_payment_operation(
  p_provider TEXT, p_operation_id TEXT, p_payment_id TEXT, p_actor_id UUID, p_action_id TEXT,
  p_capability TEXT, p_request_fingerprint TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jhadina_commerce_payment_operation; inserted BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN RAISE EXCEPTION 'ACTOR_BINDING_FAILED'; END IF;
  INSERT INTO jhadina_commerce_payment_operation
    (provider, operation_id, payment_id, actor_id, action_id, capability, request_fingerprint, status)
  VALUES (p_provider, p_operation_id, p_payment_id, p_actor_id, p_action_id, p_capability, p_request_fingerprint, 'processing')
  ON CONFLICT (provider, operation_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  SELECT * INTO r FROM jhadina_commerce_payment_operation
  WHERE provider = p_provider AND operation_id = p_operation_id;
  IF r.actor_id <> p_actor_id OR r.action_id <> p_action_id OR r.payment_id <> p_payment_id
     OR r.capability <> p_capability OR r.request_fingerprint <> p_request_fingerprint THEN
    RAISE EXCEPTION 'PAYMENT_OPERATION_BINDING_MISMATCH';
  END IF;
  RETURN jsonb_build_object('claimed', inserted, 'record', to_jsonb(r));
END; $$;

CREATE OR REPLACE FUNCTION complete_jhadina_commerce_payment_operation(
  p_provider TEXT, p_operation_id TEXT, p_payment_id TEXT, p_actor_id UUID, p_action_id TEXT,
  p_capability TEXT, p_request_fingerprint TEXT, p_provider_reference TEXT,
  p_result_status TEXT, p_result_payload JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN RAISE EXCEPTION 'ACTOR_BINDING_FAILED'; END IF;
  UPDATE jhadina_commerce_payment_operation
  SET status='completed', provider_reference=p_provider_reference, result_status=p_result_status,
      result_payload=p_result_payload, completed_at=CURRENT_TIMESTAMP
  WHERE provider=p_provider AND operation_id=p_operation_id AND payment_id=p_payment_id
    AND actor_id=p_actor_id AND action_id=p_action_id AND capability=p_capability
    AND request_fingerprint=p_request_fingerprint AND status='processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_OPERATION_NOT_PROCESSING_OR_BINDING_MISMATCH'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION fail_jhadina_commerce_payment_operation(
  p_provider TEXT, p_operation_id TEXT, p_payment_id TEXT, p_actor_id UUID, p_action_id TEXT,
  p_capability TEXT, p_request_fingerprint TEXT, p_provider_reference TEXT,
  p_result_status TEXT, p_result_payload JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN RAISE EXCEPTION 'ACTOR_BINDING_FAILED'; END IF;
  UPDATE jhadina_commerce_payment_operation
  SET status='failed', provider_reference=p_provider_reference, result_status=p_result_status,
      result_payload=p_result_payload, completed_at=CURRENT_TIMESTAMP
  WHERE provider=p_provider AND operation_id=p_operation_id AND payment_id=p_payment_id
    AND actor_id=p_actor_id AND action_id=p_action_id AND capability=p_capability
    AND request_fingerprint=p_request_fingerprint AND status='processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_OPERATION_NOT_PROCESSING_OR_BINDING_MISMATCH'; END IF;
END; $$;

REVOKE ALL ON FUNCTION claim_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_jhadina_commerce_payment_operation(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_jhadina_commerce_payment_operation(TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_jhadina_commerce_payment_operation(TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_jhadina_commerce_payment_operation(TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_jhadina_commerce_payment_operation(TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_jhadina_commerce_payment_operation(TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fail_jhadina_commerce_payment_operation(TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
