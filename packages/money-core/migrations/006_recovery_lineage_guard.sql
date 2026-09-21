-- RECOVERY-LINEAGE.FINAL
-- Recovery children are allowed only after canonical reconciliation proves the
-- parent was not executed, and only with a fresh consumed permit bound to the
-- exact persisted economics.
ALTER TABLE public.money_execution_attempts
  ADD COLUMN IF NOT EXISTS recovery_of_execution_id uuid NULL
  REFERENCES public.money_execution_attempts(attempt_id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS money_execution_attempts_recovery_parent_idx
  ON public.money_execution_attempts(recovery_of_execution_id)
  WHERE recovery_of_execution_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.jhadina_validate_money_recovery_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  p public.money_execution_attempts%ROWTYPE;
  permit_row public.money_execution_permits%ROWTYPE;
  cur uuid;
  depth integer := 0;
  latest_observed_state text;
  latest_proposal_hash text;
  latest_provider_operation text;
  latest_status text;
BEGIN
  IF NEW.recovery_of_execution_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.recovery_of_execution_id = NEW.attempt_id THEN
    RAISE EXCEPTION 'MONEY_RECOVERY_LINEAGE_CYCLE';
  END IF;

  SELECT * INTO p
  FROM public.money_execution_attempts
  WHERE attempt_id = NEW.recovery_of_execution_id
  FOR SHARE;

  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_RECOVERY_PARENT_NOT_FOUND'; END IF;
  IF NOT (p.state = 'RECOVERY_REQUIRED' OR p.recovery_required = true) THEN
    RAISE EXCEPTION 'MONEY_RECOVERY_PARENT_NOT_RECOVERABLE';
  END IF;
  IF NEW.request_id <> p.request_id THEN RAISE EXCEPTION 'MONEY_RECOVERY_REQUEST_MISMATCH'; END IF;
  IF NEW.action_fingerprint <> p.action_fingerprint THEN RAISE EXCEPTION 'MONEY_RECOVERY_ACTION_FINGERPRINT_MISMATCH'; END IF;
  IF NEW.action_snapshot IS DISTINCT FROM p.action_snapshot THEN RAISE EXCEPTION 'MONEY_RECOVERY_ACTION_SNAPSHOT_MISMATCH'; END IF;
  IF NEW.provider <> p.provider THEN RAISE EXCEPTION 'MONEY_RECOVERY_PROVIDER_MISMATCH'; END IF;
  IF NEW.operation <> p.operation THEN RAISE EXCEPTION 'MONEY_RECOVERY_OPERATION_MISMATCH'; END IF;
  IF NEW.permit_id = p.permit_id THEN RAISE EXCEPTION 'MONEY_RECOVERY_FRESH_PERMIT_REQUIRED'; END IF;

  SELECT * INTO permit_row
  FROM public.money_execution_permits
  WHERE permit_id = NEW.permit_id
  FOR SHARE;

  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_NOT_FOUND'; END IF;
  IF permit_row.state <> 'CONSUMED' THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_NOT_CONSUMED'; END IF;
  IF permit_row.action_fingerprint <> NEW.action_fingerprint THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_FINGERPRINT_MISMATCH'; END IF;
  IF permit_row.provider <> NEW.provider THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_PROVIDER_MISMATCH'; END IF;
  IF permit_row.capability <> NEW.operation THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_CAPABILITY_MISMATCH'; END IF;
  IF permit_row.user_id IS DISTINCT FROM (NEW.action_snapshot ->> 'userId') THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_USER_MISMATCH'; END IF;

  SELECT observed_state, proposal_hash, provider_operation, status
    INTO latest_observed_state, latest_proposal_hash, latest_provider_operation, latest_status
  FROM public.jhadina_connector_execution_reconciliation
  WHERE execution_id = p.attempt_id
  ORDER BY checked_at DESC, reconciliation_id DESC
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_RECOVERY_RETRY_EVIDENCE_REQUIRED'; END IF;
  IF latest_observed_state <> 'NOT_FOUND'
     OR latest_status <> 'confirmed_not_executed'
     OR latest_proposal_hash <> p.action_fingerprint
     OR latest_provider_operation <> p.operation THEN
    RAISE EXCEPTION 'MONEY_RECOVERY_RETRY_NOT_SAFE';
  END IF;

  cur := NEW.recovery_of_execution_id;
  WHILE cur IS NOT NULL LOOP
    depth := depth + 1;
    IF depth > 3 THEN RAISE EXCEPTION 'MONEY_RECOVERY_GENERATION_LIMIT'; END IF;
    SELECT recovery_of_execution_id INTO cur
    FROM public.money_execution_attempts
    WHERE attempt_id = cur;
    IF cur = NEW.attempt_id THEN RAISE EXCEPTION 'MONEY_RECOVERY_LINEAGE_CYCLE'; END IF;
  END LOOP;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_validate_money_recovery_lineage
  ON public.money_execution_attempts;

CREATE TRIGGER trg_validate_money_recovery_lineage
BEFORE INSERT OR UPDATE OF
  recovery_of_execution_id,
  request_id,
  permit_id,
  action_fingerprint,
  action_snapshot,
  provider,
  operation
ON public.money_execution_attempts
FOR EACH ROW
EXECUTE FUNCTION public.jhadina_validate_money_recovery_lineage();

REVOKE ALL ON FUNCTION public.jhadina_validate_money_recovery_lineage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.jhadina_validate_money_recovery_lineage() FROM anon;
REVOKE ALL ON FUNCTION public.jhadina_validate_money_recovery_lineage() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.jhadina_validate_money_recovery_lineage() TO service_role;
GRANT EXECUTE ON FUNCTION public.jhadina_validate_money_recovery_lineage() TO postgres;
