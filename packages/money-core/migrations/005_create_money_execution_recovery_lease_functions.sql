CREATE OR REPLACE FUNCTION public.claim_money_execution_recovery_lease(
  p_execution_id uuid,
  p_lease_id text,
  p_lease_seconds integer
)
RETURNS TABLE (
  execution_id uuid,
  lease_id text,
  lease_expires_at timestamptz,
  state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_expiry timestamptz;
BEGIN
  IF p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'MONEY_RECOVERY_LEASE_DURATION_INVALID';
  END IF;

  v_expiry := v_now + make_interval(secs => p_lease_seconds::double precision);

  RETURN QUERY
  UPDATE public.jhadina_connector_execution_ledger
  SET recovery_lease_id = p_lease_id,
      recovery_lease_expires_at = v_expiry,
      updated_at = CURRENT_TIMESTAMP
  WHERE execution_id = p_execution_id
    AND state = 'recovery_required'
    AND (
      recovery_lease_id = p_lease_id
      OR recovery_lease_id IS NULL
      OR recovery_lease_expires_at IS NULL
      OR recovery_lease_expires_at <= v_now
    )
  RETURNING
    jhadina_connector_execution_ledger.execution_id,
    jhadina_connector_execution_ledger.recovery_lease_id,
    jhadina_connector_execution_ledger.recovery_lease_expires_at,
    jhadina_connector_execution_ledger.state;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_money_execution_recovery_lease(
  p_execution_id uuid,
  p_lease_id text,
  p_lease_seconds integer
)
RETURNS TABLE (
  execution_id uuid,
  lease_id text,
  lease_expires_at timestamptz,
  state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_expiry timestamptz;
BEGIN
  IF p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'MONEY_RECOVERY_LEASE_DURATION_INVALID';
  END IF;

  v_expiry := v_now + make_interval(secs => p_lease_seconds::double precision);

  RETURN QUERY
  UPDATE public.jhadina_connector_execution_ledger
  SET recovery_lease_expires_at = v_expiry,
      updated_at = CURRENT_TIMESTAMP
  WHERE execution_id = p_execution_id
    AND state = 'recovery_required'
    AND recovery_lease_id = p_lease_id
    AND recovery_lease_expires_at IS NOT NULL
    AND recovery_lease_expires_at > v_now
  RETURNING
    jhadina_connector_execution_ledger.execution_id,
    jhadina_connector_execution_ledger.recovery_lease_id,
    jhadina_connector_execution_ledger.recovery_lease_expires_at,
    jhadina_connector_execution_ledger.state;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_money_execution_recovery_lease(
  p_execution_id uuid,
  p_lease_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  UPDATE public.jhadina_connector_execution_ledger
  SET recovery_lease_id = NULL,
      recovery_lease_expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE execution_id = p_execution_id
    AND state = 'recovery_required'
    AND recovery_lease_id = p_lease_id
  RETURNING true INTO v_updated;

  RETURN COALESCE(v_updated, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_money_execution_recovery_lease(uuid,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_money_execution_recovery_lease(uuid,text,integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_money_execution_recovery_lease(uuid,text,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_money_execution_recovery_lease(uuid,text,integer) TO service_role;

REVOKE ALL ON FUNCTION public.renew_money_execution_recovery_lease(uuid,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renew_money_execution_recovery_lease(uuid,text,integer) FROM anon;
REVOKE ALL ON FUNCTION public.renew_money_execution_recovery_lease(uuid,text,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.renew_money_execution_recovery_lease(uuid,text,integer) TO service_role;

REVOKE ALL ON FUNCTION public.release_money_execution_recovery_lease(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_money_execution_recovery_lease(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.release_money_execution_recovery_lease(uuid,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_money_execution_recovery_lease(uuid,text) TO service_role;
