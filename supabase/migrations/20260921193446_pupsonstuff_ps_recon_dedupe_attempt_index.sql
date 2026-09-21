-- PS-RECON performance cleanup.
--
-- pupson_creative_job_attempts already has the canonical UNIQUE constraint
-- pupson_creative_job_attempts_job_id_attempt_key on (job_id, attempt).
-- An earlier reconciliation migration added a second identical unique index.
-- Drop only the redundant index; the canonical constraint remains authoritative.

drop index if exists public.pupson_creative_job_attempts_job_attempt_uidx;
