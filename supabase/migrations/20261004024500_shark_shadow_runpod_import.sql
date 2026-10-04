-- SHADOW-RUNPOD.7
-- Fail-closed staging lane for importing RunPod shadow-learning evidence into SWLC.
-- Imported records are evidence only and are never promoted directly into live execution authority.

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_runpod_imports (
  import_id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('DECISION','EXECUTION','OBSERVATION','LESSON','CALIBRATION','MEMORY','REPLAY')),
  record_id TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256)=64),
  payload_json JSONB NOT NULL,
  source_created_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reconciliation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (reconciliation_status IN ('PENDING','RECONCILED','REJECTED')),
  authority TEXT NOT NULL DEFAULT 'SHADOW_IMPORT_EVIDENCE_ONLY' CHECK (authority='SHADOW_IMPORT_EVIDENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  UNIQUE(record_type,record_id)
);

CREATE INDEX IF NOT EXISTS money_shark_shadow_runpod_imports_status_idx
  ON public.money_shark_shadow_runpod_imports(reconciliation_status,imported_at);
CREATE INDEX IF NOT EXISTS money_shark_shadow_runpod_imports_record_idx
  ON public.money_shark_shadow_runpod_imports(record_type,record_id);

REVOKE ALL ON TABLE public.money_shark_shadow_runpod_imports FROM PUBLIC;
REVOKE ALL ON TABLE public.money_shark_shadow_runpod_imports FROM anon;
REVOKE ALL ON TABLE public.money_shark_shadow_runpod_imports FROM authenticated;
REVOKE ALL ON TABLE public.money_shark_shadow_runpod_imports FROM service_role;
ALTER TABLE public.money_shark_shadow_runpod_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_shark_shadow_runpod_imports FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON TABLE public.money_shark_shadow_runpod_imports TO service_role;

DROP POLICY IF EXISTS money_shark_shadow_runpod_imports_service_role_only
  ON public.money_shark_shadow_runpod_imports;
CREATE POLICY money_shark_shadow_runpod_imports_service_role_only
  ON public.money_shark_shadow_runpod_imports
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.money_shark_shadow_runpod_imports IS
  'Raw RunPod shadow-learning evidence staged for later reconciliation. Never execution authority.';
