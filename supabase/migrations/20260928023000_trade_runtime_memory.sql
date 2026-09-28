-- TRADE-RUNTIME.FINAL shared trade memory projection.
-- The event journal remains append-only authority for event history.
-- This table stores the latest canonical projection for fast Jhadina/SHARK/Money reads.

CREATE TABLE IF NOT EXISTS public.jhadina_trade_memory_records (
  trade_id TEXT PRIMARY KEY,
  run_lineage_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  record JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS jhadina_trade_memory_lineage_idx
  ON public.jhadina_trade_memory_records (run_lineage_id);

CREATE INDEX IF NOT EXISTS jhadina_trade_memory_strategy_idx
  ON public.jhadina_trade_memory_records (strategy_id, updated_at DESC);

ALTER TABLE public.jhadina_trade_memory_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jhadina_trade_memory_records FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.jhadina_trade_memory_records FROM PUBLIC;
REVOKE ALL ON TABLE public.jhadina_trade_memory_records FROM anon;
REVOKE ALL ON TABLE public.jhadina_trade_memory_records FROM authenticated;
REVOKE ALL ON TABLE public.jhadina_trade_memory_records FROM service_role;

DROP POLICY IF EXISTS jhadina_trade_memory_service_role ON public.jhadina_trade_memory_records;
CREATE POLICY jhadina_trade_memory_service_role
  ON public.jhadina_trade_memory_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.jhadina_trade_memory_records TO service_role;

COMMENT ON TABLE public.jhadina_trade_memory_records IS
  'Latest canonical projection of the durable trade-event stream. Contains evidence references and structured trade state; never private keys, seed phrases, signer tokens, or raw signed transactions.';
