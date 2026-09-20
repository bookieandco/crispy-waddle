-- MONEY-R1C: bind every Money execution permit to one exact Action Core
-- request and downstream authority proof.
--
-- Legacy ISSUED permits were created before these bindings existed. They are
-- revoked rather than grandfathered, preventing an old permit from becoming
-- executable under the stronger R1C verification rules.

ALTER TABLE money_execution_permits
  ADD COLUMN IF NOT EXISTS action_request_fingerprint TEXT;

ALTER TABLE money_execution_permits
  ADD COLUMN IF NOT EXISTS authority_id TEXT;

UPDATE money_execution_permits
SET state = 'REVOKED',
    revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
WHERE state = 'ISSUED'
  AND (
    action_request_fingerprint IS NULL
    OR authority_id IS NULL
  );

UPDATE money_execution_permits
SET action_request_fingerprint =
      COALESCE(action_request_fingerprint, action_fingerprint),
    authority_id =
      COALESCE(authority_id, 'legacy-revoked:' || permit_id)
WHERE action_request_fingerprint IS NULL
   OR authority_id IS NULL;

ALTER TABLE money_execution_permits
  ALTER COLUMN action_request_fingerprint SET NOT NULL;

ALTER TABLE money_execution_permits
  ALTER COLUMN authority_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS
  idx_money_execution_permits_action_request_fingerprint
  ON money_execution_permits (action_request_fingerprint);

CREATE INDEX IF NOT EXISTS
  idx_money_execution_permits_authority_id
  ON money_execution_permits (authority_id);
