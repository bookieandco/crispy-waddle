-- LOCAL-GOV.2A — cover the discovery-job jurisdiction foreign key.
-- Forward-only follow-up to the already-applied public_opportunity_discovery migration.

create index if not exists jhadina_public_source_discovery_jobs_jurisdiction_idx
  on public.jhadina_public_source_discovery_jobs (jurisdiction_id);
