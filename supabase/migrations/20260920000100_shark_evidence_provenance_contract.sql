-- SHARK-QA.16B: durable launch/actor records must retain provenance.
-- Empty evidence arrays would make persisted intelligence non-auditable.
alter table public.jhadina_token_launches
  drop constraint if exists jhadina_token_launches_evidence_required;
alter table public.jhadina_token_launches
  add constraint jhadina_token_launches_evidence_required
  check (cardinality(evidence_ids) > 0);

alter table public.jhadina_token_actor_edges
  drop constraint if exists jhadina_token_actor_edges_evidence_required;
alter table public.jhadina_token_actor_edges
  add constraint jhadina_token_actor_edges_evidence_required
  check (cardinality(evidence_ids) > 0);
