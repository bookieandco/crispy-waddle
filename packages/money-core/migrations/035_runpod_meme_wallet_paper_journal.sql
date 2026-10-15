-- MEME-WALLET.09–.12: private RunPod/Postgres paper-only journal.
-- Deliberately separate from Coffer, live trade, signer, wallets and P&L ledgers.
-- DBA must manually review/apply. No public RPC/API view or migration executed here.
CREATE TABLE IF NOT EXISTS runpod_meme_wallet_paper_decisions (
  decision_id text PRIMARY KEY,
  wallet_id text NOT NULL,
  candidate_case_id text NOT NULL,
  disposition text NOT NULL CHECK (disposition IN ('PAPER_ADMIT','PAPER_BLOCK')),
  proposed_entry_minor numeric(38,0) NOT NULL CHECK (proposed_entry_minor > 0),
  decision_json jsonb NOT NULL,
  authority text NOT NULL DEFAULT 'PAPER_SIMULATION_ONLY' CHECK (authority='PAPER_SIMULATION_ONLY'),
  can_sign boolean NOT NULL DEFAULT false CHECK (can_sign=false),
  can_execute boolean NOT NULL DEFAULT false CHECK (can_execute=false),
  can_move_money boolean NOT NULL DEFAULT false CHECK (can_move_money=false),
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  UNIQUE(wallet_id,candidate_case_id),
  CHECK (decision_json->>'canExecute'='false'),
  CHECK (decision_json->>'canSign'='false'),
  CHECK (decision_json->>'canMoveMoney'='false'),
  CHECK (decision_json->>'authority'='PAPER_SIMULATION_ONLY')
);

CREATE TABLE IF NOT EXISTS runpod_meme_wallet_paper_receipts (
  decision_id text PRIMARY KEY REFERENCES runpod_meme_wallet_paper_decisions(decision_id),
  receipt_state text NOT NULL CHECK (receipt_state IN ('PAPER_FILLED','PAPER_FAILED','PAPER_UNKNOWN')),
  receipt_json jsonb NOT NULL,
  simulated_at timestamptz NOT NULL,
  authority text NOT NULL DEFAULT 'SIMULATED_SETTLEMENT_ONLY' CHECK(authority='SIMULATED_SETTLEMENT_ONLY'),
  can_execute boolean NOT NULL DEFAULT false CHECK(can_execute=false),
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  CHECK (receipt_json->>'canExecute'='false'),
  CHECK (receipt_json->>'authority'='SIMULATED_SETTLEMENT_ONLY')
);
CREATE INDEX IF NOT EXISTS runpod_meme_paper_wallet_created_idx
 ON runpod_meme_wallet_paper_decisions(wallet_id,created_at);

CREATE OR REPLACE FUNCTION runpod_meme_wallet_paper_forbid_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'MEME_WALLET_PAPER_APPEND_ONLY';
END;
$$;
REVOKE ALL ON FUNCTION runpod_meme_wallet_paper_forbid_mutation() FROM PUBLIC;
DROP TRIGGER IF EXISTS runpod_meme_paper_decision_immutable ON runpod_meme_wallet_paper_decisions;
CREATE TRIGGER runpod_meme_paper_decision_immutable
 BEFORE UPDATE OR DELETE ON runpod_meme_wallet_paper_decisions
 FOR EACH ROW EXECUTE FUNCTION runpod_meme_wallet_paper_forbid_mutation();
DROP TRIGGER IF EXISTS runpod_meme_paper_receipt_immutable ON runpod_meme_wallet_paper_receipts;
CREATE TRIGGER runpod_meme_paper_receipt_immutable
 BEFORE UPDATE OR DELETE ON runpod_meme_wallet_paper_receipts
 FOR EACH ROW EXECUTE FUNCTION runpod_meme_wallet_paper_forbid_mutation();

REVOKE ALL ON runpod_meme_wallet_paper_decisions FROM PUBLIC;
REVOKE ALL ON runpod_meme_wallet_paper_receipts FROM PUBLIC;
COMMENT ON TABLE runpod_meme_wallet_paper_decisions IS
 'Owner-created wallet memecoin PAPER ONLY. No signing, broadcasts, profit accounting or custody.';
COMMENT ON TABLE runpod_meme_wallet_paper_receipts IS
 'Append-only simulated outcomes; never proof of execution or real realized P&L.';
-- Independent DBA grants SELECT and INSERT to restricted paper worker role;
-- NEVER reuse generic SHARK/DEX/Coffer execution role or Supabase service key.
