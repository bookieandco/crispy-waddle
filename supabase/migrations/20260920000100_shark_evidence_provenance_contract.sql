-- SHARK-QA.16B: durable launch/actor records must retain provenance.
-- Empty evidence arrays make persisted intelligence non-auditable.
--
-- Use NOT VALID for compatibility with legacy rows that may predate the
-- provenance contract. PostgreSQL still enforces these checks for new/updated
-- rows; historical rows can be audited and repaired before explicit validation.

alter table public.jhadina_token_launches
  drop constraint if exists jhadina_token_launches_evidence_required;
alter table public.jhadina_token_launches
  add constraint jhadina_token_launches_evidence_required
  check (cardinality(evidence_ids) > 0) not valid;

alter table public.jhadina_token_actor_edges
  drop constraint if exists jhadina_token_actor_edges_evidence_required;
alter table public.jhadina_token_actor_edges
  add constraint jhadina_token_actor_edges_evidence_required
  check (cardinality(evidence_ids) > 0) not valid;
