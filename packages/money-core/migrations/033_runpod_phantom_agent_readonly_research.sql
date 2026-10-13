-- SHARK/SHADOW research-only Phantom agent wallet observations.
-- Standalone RunPod/Postgres migration, NOT Supabase public schema.
-- Separate from trade decisions, P&L, authorization and custody.
CREATE TABLE IF NOT EXISTS runpod_phantom_agent_research_observations (
  case_id TEXT PRIMARY KEY,
  parent_case_id TEXT,
  wallet_id TEXT NOT NULL,
  subject_id TEXT NOT NULL CHECK(subject_id LIKE 'wallet:solana:%'),
  chain_id TEXT NOT NULL DEFAULT 'solana-mainnet-beta' CHECK(chain_id='solana-mainnet-beta'),
  slot BIGINT NOT NULL CHECK(slot>0),
  native_balance_lamports NUMERIC(38,0) NOT NULL CHECK(native_balance_lamports>=0),
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL CHECK(cardinality(evidence_ids)>=3),
  source_study_digest TEXT NOT NULL UNIQUE CHECK(source_study_digest ~ '^[0-9a-f]{64}$'),
  observation_json JSONB NOT NULL,
  authority TEXT NOT NULL DEFAULT 'SHADOW_LEARNING_ONLY' CHECK(authority='SHADOW_LEARNING_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK(can_execute=FALSE),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK(can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (case_id='phantom-agent-native-sol:' || source_study_digest)
);

CREATE INDEX IF NOT EXISTS runpod_phantom_research_wallet_slot_idx
 ON runpod_phantom_agent_research_observations(wallet_id,slot DESC);

-- No changes or deletion after an observed fact has been admitted.
CREATE OR REPLACE FUNCTION runpod_phantom_agent_research_immutable() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PHANTOM_RESEARCH_APPEND_ONLY';
END;
$$;
REVOKE ALL ON FUNCTION runpod_phantom_agent_research_immutable() FROM PUBLIC;
DROP TRIGGER IF EXISTS runpod_phantom_agent_research_reject_changes
 ON runpod_phantom_agent_research_observations;
CREATE TRIGGER runpod_phantom_agent_research_reject_changes
 BEFORE UPDATE OR DELETE ON runpod_phantom_agent_research_observations
 FOR EACH ROW EXECUTE FUNCTION runpod_phantom_agent_research_immutable();

REVOKE ALL ON runpod_phantom_agent_research_observations FROM PUBLIC;

-- DBA MUST grant ONLY SELECT and INSERT to a dedicated non-superuser research
-- importer role; never grant DELETE/UPDATE/TRUNCATE to an app or agent role.
-- This table must NOT become a shadow trade decision or live execution source.
COMMENT ON TABLE runpod_phantom_agent_research_observations IS
 'Phantom MCP agent native SOL observations only, research provenance. No execution, no PnL, no trading authority.';
