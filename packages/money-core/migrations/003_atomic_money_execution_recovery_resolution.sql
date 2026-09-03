CREATE OR REPLACE FUNCTION public.resolve_money_execution_recovery_atomic(
  p_attempt_id uuid,
  p_proposal_hash text,
  p_lease_id text,
  p_state text,
  p_provider_reference text,
  p_error_code text,
  p_error_message text,
  p_recovery_required boolean,
  p_reason text,
  p_observation jsonb,
  p_completed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id uuid;
  v_ledger_state text;
BEGIN
  IF p_state NOT IN ('SUCCEEDED', 'FAILED') THEN
    RAISE EXCEPTION 'MONEY_ATOMIC_RECOVERY_INVALID_STATE';
  END IF;

  v_ledger_state := CASE p_state
    WHEN 'SUCCEEDED' THEN 'recovered'
    WHEN 'FAILED' THEN 'failed'
  END;

  UPDATE public.money_execution_attempts
  SET state = p_state,
      provider_reference = p_provider_reference,
      error_code = p_error_code,
      error_message = p_error_message,
      recovery_required = p_recovery_required,
      completed_at = p_completed_at,
      updated_at = CURRENT_TIMESTAMP
  WHERE attempt_id = p_attempt_id
    AND state IN ('UNKNOWN', 'RECOVERY_REQUIRED')
  RETURNING attempt_id INTO v_attempt_id;

  IF v_attempt_id IS NULL THEN
    RAISE EXCEPTION 'MONEY_EXECUTION_ATTEMPT_NOT_RECOVERABLE';
  END IF;

  UPDATE public.jhadina_connector_execution_ledger
  SET state = v_ledger_state,
      response = jsonb_build_object(
        'providerReference', p_provider_reference,
        'reason', p_reason,
        'observation', p_observation
      ),
      error = CASE WHEN p_state = 'FAILED' THEN p_reason ELSE NULL END,
      completed_at = p_completed_at,
      recovery_lease_id = NULL,
      recovery_lease_expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE execution_id = p_attempt_id
    AND proposal_hash = p_proposal_hash
    AND state = 'recovery_required'
    AND recovery_lease_id = p_lease_id
    AND recovery_lease_expires_at > CURRENT_TIMESTAMP;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MONEY_RECOVERY_LEASE_LOST';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_money_execution_recovery_atomic(uuid,text,text,text,text,text,text,boolean,text,jsonb,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_money_execution_recovery_atomic(uuid,text,text,text,text,text,text,boolean,text,jsonb,timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_money_execution_recovery_atomic(uuid,text,text,text,text,text,text,boolean,text,jsonb,timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_money_execution_recovery_atomic(uuid,text,text,text,text,text,text,boolean,text,jsonb,timestamptz) TO service_role;
