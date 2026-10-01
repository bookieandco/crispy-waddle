-- PUPSON-EXPERIENCE convergence.
-- Preserve the Pupson creative job as business authority while recording the
-- provider-neutral Jhadina compute draft used for placement/runtime lineage.
alter table public.pupson_creative_jobs
  add column if not exists compute_workload jsonb not null default '{}'::jsonb;

create index if not exists pupson_jobs_pet_product_idx
  on public.pupson_creative_jobs (pet_identity_id, product_id, created_at desc);

comment on column public.pupson_creative_jobs.compute_workload is
  'Provider-neutral @jhadina/compute-core workload draft; does not itself authorize execution or cloud spend.';
