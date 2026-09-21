-- RECOVERY-LINEAGE.FINAL: make a recovery retry impossible without
-- canonical NOT_FOUND reconciliation evidence and a fresh consumed permit.

ALTER TABLE public.money_execution_attempts
  ADD COLUMN IF NOT EXISTS recovery_of_execution_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.money_execution_attempts'::regclass
      AND conname='money_execution_attempts_recovery_of_execution_id_fkey'
  ) THEN
    ALTER TABLE public.money_execution_attempts
      ADD CONSTRAINT money_execution_attempts_recovery_of_execution_id_fkey
      FOREIGN KEY (recovery_of_execution_id)
      REFERENCES public.money_execution_attempts(attempt_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS money_execution_attempts_recovery_parent_idx
  ON public.money_execution_attempts(recovery_of_execution_id)
  WHERE recovery_of_execution_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.jhadina_validate_money_recovery_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=public
AS $$
DECLARE
  p public.money_execution_attempts%rowtype;
  retry_permit public.money_execution_permits%rowtype;
  parent_permit public.money_execution_permits%rowtype;
  latest_reconciliation record;
  cur uuid;
  depth integer:=0;
BEGIN
  IF new.recovery_of_execution_id IS NULL THEN RETURN new; END IF;
  IF new.recovery_of_execution_id=new.attempt_id THEN RAISE EXCEPTION 'MONEY_RECOVERY_LINEAGE_CYCLE'; END IF;

  SELECT * INTO p FROM public.money_execution_attempts
  WHERE attempt_id=new.recovery_of_execution_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_RECOVERY_PARENT_NOT_FOUND'; END IF;
  IF NOT (p.state='RECOVERY_REQUIRED' OR p.recovery_required=true) THEN RAISE EXCEPTION 'MONEY_RECOVERY_PARENT_NOT_RECOVERABLE'; END IF;

  IF new.request_id<>p.request_id THEN RAISE EXCEPTION 'MONEY_RECOVERY_REQUEST_MISMATCH'; END IF;
  IF new.action_fingerprint<>p.action_fingerprint THEN RAISE EXCEPTION 'MONEY_RECOVERY_ACTION_FINGERPRINT_MISMATCH'; END IF;
  IF new.action_snapshot IS DISTINCT FROM p.action_snapshot THEN RAISE EXCEPTION 'MONEY_RECOVERY_ACTION_SNAPSHOT_MISMATCH'; END IF;
  IF new.provider<>p.provider THEN RAISE EXCEPTION 'MONEY_RECOVERY_PROVIDER_MISMATCH'; END IF;
  IF new.operation<>p.operation THEN RAISE EXCEPTION 'MONEY_RECOVERY_OPERATION_MISMATCH'; END IF;

  IF new.permit_id=p.permit_id THEN RAISE EXCEPTION 'MONEY_RECOVERY_FRESH_PERMIT_REQUIRED'; END IF;
  SELECT * INTO retry_permit FROM public.money_execution_permits WHERE permit_id=new.permit_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_NOT_FOUND'; END IF;
  SELECT * INTO parent_permit FROM public.money_execution_permits WHERE permit_id=p.permit_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_RECOVERY_PARENT_PERMIT_NOT_FOUND'; END IF;
  IF retry_permit.state<>'CONSUMED' THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_NOT_CONSUMED'; END IF;
  IF retry_permit.action_fingerprint<>new.action_fingerprint THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_ACTION_MISMATCH'; END IF;
  IF retry_permit.action_request_fingerprint<>parent_permit.action_request_fingerprint THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_REQUEST_MISMATCH'; END IF;
  IF retry_permit.provider<>new.provider THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_PROVIDER_MISMATCH'; END IF;
  IF retry_permit.capability<>new.operation THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_CAPABILITY_MISMATCH'; END IF;
  IF retry_permit.user_id IS DISTINCT FROM (new.action_snapshot->>'userId') THEN RAISE EXCEPTION 'MONEY_RECOVERY_PERMIT_USER_MISMATCH'; END IF;

  SELECT observed_state,proposal_hash,provider_operation,status,evidence_hash,checked_at
  INTO latest_reconciliation
  FROM public.jhadina_connector_execution_reconciliation
  WHERE execution_id=p.attempt_id
  ORDER BY checked_at DESC,reconciliation_id DESC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_RECOVERY_RETRY_EVIDENCE_REQUIRED'; END IF;
  IF latest_reconciliation.observed_state<>'NOT_FOUND'
     OR latest_reconciliation.status<>'confirmed_not_executed'
     OR latest_reconciliation.proposal_hash<>p.action_fingerprint
     OR latest_reconciliation.provider_operation<>p.operation
  THEN RAISE EXCEPTION 'MONEY_RECOVERY_RETRY_NOT_SAFE'; END IF;
  IF latest_reconciliation.evidence_hash IS NULL OR latest_reconciliation.evidence_hash='' THEN RAISE EXCEPTION 'MONEY_RECOVERY_RETRY_EVIDENCE_HASH_REQUIRED'; END IF;

  cur:=new.recovery_of_execution_id;
  WHILE cur IS NOT NULL LOOP
    depth:=depth+1;
    IF depth>3 THEN RAISE EXCEPTION 'MONEY_RECOVERY_GENERATION_LIMIT'; END IF;
    SELECT recovery_of_execution_id INTO cur FROM public.money_execution_attempts WHERE attempt_id=cur;
    IF cur=new.attempt_id THEN RAISE EXCEPTION 'MONEY_RECOVERY_LINEAGE_CYCLE'; END IF;
  END LOOP;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_validate_money_recovery_lineage ON public.money_execution_attempts;
CREATE TRIGGER trg_validate_money_recovery_lineage
BEFORE INSERT OR UPDATE OF recovery_of_execution_id,request_id,permit_id,action_fingerprint,action_snapshot,provider,operation
ON public.money_execution_attempts
FOR EACH ROW EXECUTE FUNCTION public.jhadina_validate_money_recovery_lineage();

REVOKE ALL ON FUNCTION public.jhadina_validate_money_recovery_lineage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.jhadina_validate_money_recovery_lineage() FROM anon;
REVOKE ALL ON FUNCTION public.jhadina_validate_money_recovery_lineage() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.jhadina_validate_money_recovery_lineage() TO service_role;
GRANT EXECUTE ON FUNCTION public.jhadina_validate_money_recovery_lineage() TO postgres;
