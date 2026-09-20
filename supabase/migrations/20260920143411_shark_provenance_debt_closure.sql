-- SHARK-QA.17F: close legacy provenance debt, validate evidence constraints,
-- and remove indexes that duplicate primary/unique indexes.

-- Prefer durable upstream identifiers when reconstructing provenance for legacy
-- launch rows. The legacy:* prefix is an audit marker, not a claim that a new
-- external observation was made by this migration.
update public.jhadina_token_launches
set evidence_ids = array[
  case
    when nullif(signature, '') is not null then 'legacy:signature:' || signature
    when nullif(observation_id, '') is not null then 'legacy:observation:' || observation_id
    else 'legacy:launch:' || launch_id || ':source:' || coalesce(nullif(source, ''), 'unknown')
  end
]
where cardinality(coalesce(evidence_ids, '{}'::text[])) = 0;

-- Actor edges inherit the canonical launch evidence when their pre-contract row
-- lacks relationship-level provenance. This preserves traceability without
-- inventing a wallet/developer relationship source.
update public.jhadina_token_actor_edges e
set evidence_ids = l.evidence_ids
from public.jhadina_token_launches l
where e.launch_id = l.launch_id
  and cardinality(coalesce(e.evidence_ids, '{}'::text[])) = 0;

alter table public.jhadina_token_launches
  validate constraint jhadina_token_launches_evidence_required;
alter table public.jhadina_token_actor_edges
  validate constraint jhadina_token_actor_edges_evidence_required;

-- actor_key is already the primary key.
drop index if exists public.jhadina_actor_outcome_history_actor_key_idx;

-- Keep the original actor_idx and remove the identical later kind_id index.
drop index if exists public.jhadina_actor_outcome_history_kind_id_idx;

-- (chain_id, token_address) is already protected by the table unique constraint.
drop index if exists public.jhadina_token_launches_token_idx;
drop index if exists public.jhadina_token_launches_chain_token_uidx;
