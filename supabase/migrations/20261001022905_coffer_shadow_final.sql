-- COFFER-SHADOW.FINAL — durable no-sign/no-broadcast shadow evidence.
-- Shadow rows are evidence only and grant no wallet, signer, permit, or broadcast authority.

CREATE TABLE IF NOT EXISTS public.money_dex_shadow_runs (
  shadow_run_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  run_lineage_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  selected_provider TEXT CHECK (selected_provider IN ('jupiter-swap-v2','raydium-direct','meteora-direct')),
  route_decision JSONB NOT NULL,
  stage_evidence JSONB NOT NULL,
  certification JSONB NOT NULL,
  signed_transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (signed_transaction_count = 0),
  broadcast_count INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_count = 0),
  financial_authority TEXT NOT NULL DEFAULT 'NONE' CHECK (financial_authority = 'NONE'),
  authority TEXT NOT NULL DEFAULT 'COFFER_SHADOW_EVIDENCE_ONLY' CHECK (authority = 'COFFER_SHADOW_EVIDENCE_ONLY'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS money_dex_shadow_runs_user_observed_idx
  ON public.money_dex_shadow_runs(user_id, observed_at DESC);

ALTER TABLE public.money_dex_shadow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_dex_shadow_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.money_dex_shadow_runs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.money_dex_shadow_runs TO service_role;

COMMENT ON TABLE public.money_dex_shadow_runs IS
  'COFFER-SHADOW.FINAL route/gate evidence. Invariants force zero signatures, zero broadcasts, and no financial authority.';
