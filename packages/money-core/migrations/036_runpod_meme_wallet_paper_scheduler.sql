-- MEME-WALLET.13–.16, OWNER REVIEW REQUIRED. NO LIVE FUNDS OR SIGNER.
-- Private research PostgreSQL (not Supabase public API). Never auto-apply.
-- One immutable claim per wallet and scheduled UTC minute prevents duplicate
-- unattended paper work across workers or restarts. Failed/interrupted claims
-- remain consumed until an independent operator investigates; never retry a
-- partially processed slot automatically.
CREATE TABLE IF NOT EXISTS runpod_meme_wallet_paper_cycle_claims (
  claim_id text PRIMARY KEY CHECK (claim_id ~ '^meme-paper-slot:[0-9a-f]{64}$'),
  wallet_id text NOT NULL,
  utc_minute timestamptz NOT NULL,
  owner_policy_id text NOT NULL,
  source_batch_id text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT current_timestamp,
  authority text NOT NULL DEFAULT 'PAPER_CYCLE_CLAIM_ONLY' CHECK (authority='PAPER_CYCLE_CLAIM_ONLY'),
  can_execute boolean NOT NULL DEFAULT false CHECK (can_execute=false),
  UNIQUE(wallet_id,utc_minute)
);
-- Owner kill-switch is an irreversible append-only latch per wallet. Re-enable
-- requires a separately reviewed operator procedure, NEVER an agent action.
CREATE TABLE IF NOT EXISTS runpod_meme_wallet_paper_halts (
  halt_id text PRIMARY KEY,
  wallet_id text NOT NULL,
  reason_code text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT current_timestamp,
  authority text NOT NULL DEFAULT 'PAPER_HALT_ONLY' CHECK (authority='PAPER_HALT_ONLY'),
  can_execute boolean NOT NULL DEFAULT false CHECK (can_execute=false)
);
CREATE INDEX IF NOT EXISTS runpod_meme_wallet_paper_halt_wallet_idx
  ON runpod_meme_wallet_paper_halts(wallet_id,requested_at DESC);
DROP TRIGGER IF EXISTS runpod_meme_paper_claim_immutable
  ON runpod_meme_wallet_paper_cycle_claims;
CREATE TRIGGER runpod_meme_paper_claim_immutable
  BEFORE UPDATE OR DELETE ON runpod_meme_wallet_paper_cycle_claims
  FOR EACH ROW EXECUTE FUNCTION runpod_meme_wallet_paper_forbid_mutation();
DROP TRIGGER IF EXISTS runpod_meme_paper_halt_immutable
  ON runpod_meme_wallet_paper_halts;
CREATE TRIGGER runpod_meme_paper_halt_immutable
  BEFORE UPDATE OR DELETE ON runpod_meme_wallet_paper_halts
  FOR EACH ROW EXECUTE FUNCTION runpod_meme_wallet_paper_forbid_mutation();
REVOKE ALL ON runpod_meme_wallet_paper_cycle_claims FROM PUBLIC;
REVOKE ALL ON runpod_meme_wallet_paper_halts FROM PUBLIC;
COMMENT ON TABLE runpod_meme_wallet_paper_cycle_claims IS
 'Append-only at-most-once UTC paper scheduler claim; a claimed slot cannot be retried automatically.';
COMMENT ON TABLE runpod_meme_wallet_paper_halts IS
 'Irreversible append-only halt of Jhadina memecoin paper worker. No live money path.';
-- DBA manually grants SELECT,INSERT on four paper-only tables to an
-- isolated restricted principal with NO grants to Coffer/DEX/wallet tables.
