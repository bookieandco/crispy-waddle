-- COFFER-TREASURY multi-asset evidence + conversion durability.
-- Existing MONEY-FUND rails remain authoritative for deposits/withdrawals/transfers.
-- Conversion is intentionally separate so cross-asset exchange cannot masquerade as a transfer.
-- No bank credentials, wallet keys, seed phrases, raw signer tokens, or provider execution secrets are stored here.

CREATE TABLE IF NOT EXISTS public.money_coffer_asset_balance_snapshots (
  balance_snapshot_id TEXT PRIMARY KEY,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  custody_id TEXT NOT NULL,
  custody_kind TEXT NOT NULL CHECK (custody_kind IN ('BANK','BROKER_CASH','COFFER_CASH','CRYPTO_WALLET','EXCHANGE')),
  provider TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('FIAT','STABLECOIN','CRYPTO')),
  amount_atomic NUMERIC(78,0) NOT NULL CHECK (amount_atomic >= 0),
  decimals INTEGER NOT NULL CHECK (decimals BETWEEN 0 AND 36),
  reporting_currency TEXT NOT NULL,
  reporting_value_minor BIGINT NOT NULL CHECK (reporting_value_minor >= 0),
  reserved_reporting_value_minor BIGINT NOT NULL DEFAULT 0 CHECK (reserved_reporting_value_minor >= 0 AND reserved_reporting_value_minor <= reporting_value_minor),
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'TREASURY_BALANCE_EVIDENCE' CHECK (authority = 'TREASURY_BALANCE_EVIDENCE'),
  can_move_money BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_move_money = FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS money_coffer_asset_balance_user_time_idx
  ON public.money_coffer_asset_balance_snapshots(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS money_coffer_asset_balance_coffer_asset_time_idx
  ON public.money_coffer_asset_balance_snapshots(coffer_id, asset_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.money_coffer_conversion_events (
  conversion_event_id TEXT PRIMARY KEY,
  conversion_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('QUOTED','APPROVAL_REQUESTED','APPROVED','SUBMITTED','SETTLED','FAILED','EXPIRED','RECONCILED')),
  provider TEXT NOT NULL,
  quote_id TEXT,
  source_endpoint_id TEXT NOT NULL,
  destination_endpoint_id TEXT NOT NULL,
  source_asset_id TEXT NOT NULL,
  destination_asset_id TEXT NOT NULL,
  source_amount_atomic NUMERIC(78,0) NOT NULL CHECK (source_amount_atomic > 0),
  quoted_destination_amount_atomic NUMERIC(78,0),
  minimum_destination_amount_atomic NUMERIC(78,0) NOT NULL CHECK (minimum_destination_amount_atomic > 0),
  provider_fee_source_atomic NUMERIC(78,0) NOT NULL DEFAULT 0 CHECK (provider_fee_source_atomic >= 0),
  network_fee_source_atomic NUMERIC(78,0) NOT NULL DEFAULT 0 CHECK (network_fee_source_atomic >= 0),
  spread_bps INTEGER NOT NULL DEFAULT 0 CHECK (spread_bps BETWEEN 0 AND 10000),
  idempotency_key TEXT NOT NULL,
  provider_reference TEXT,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'CONVERSION_EVIDENCE_ONLY' CHECK (authority = 'CONVERSION_EVIDENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute = FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conversion_id, event_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS money_coffer_conversion_events_user_time_idx
  ON public.money_coffer_conversion_events(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS money_coffer_conversion_events_coffer_time_idx
  ON public.money_coffer_conversion_events(coffer_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS money_coffer_conversion_events_conversion_idx
  ON public.money_coffer_conversion_events(conversion_id, observed_at ASC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_coffer_asset_balance_snapshots',
    'money_coffer_conversion_events'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role',t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;

GRANT SELECT, INSERT ON public.money_coffer_asset_balance_snapshots TO service_role;
GRANT SELECT, INSERT ON public.money_coffer_conversion_events TO service_role;

COMMENT ON TABLE public.money_coffer_asset_balance_snapshots IS
  'Append-only multi-asset Coffer balance/valuation evidence across fiat, stablecoins and crypto. Evidence has no money-movement authority.';
COMMENT ON TABLE public.money_coffer_conversion_events IS
  'Append-only fiat FX, fiat/crypto and crypto/crypto conversion evidence. Conversion events never grant execution authority.';
