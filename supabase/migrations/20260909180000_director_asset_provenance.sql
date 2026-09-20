-- Persist the immutable creative lineage used to produce each Director asset.
-- Provenance is audit data, not an authorization grant; review gates validate it
-- against the current production/stage lineage before accepting the asset.
alter table public.director_generated_editing_assets
  add column if not exists provenance jsonb;

create index if not exists director_generated_editing_assets_provenance_job_idx
  on public.director_generated_editing_assets ((provenance->>'generationJobId'));
