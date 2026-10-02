-- LOCAL-GOV.PROD — bounded national convergence state and provider queue receipts.

alter table public.jhadina_public_source_discovery_jobs
  add column if not exists state_code text;

update public.jhadina_public_source_discovery_jobs j
   set state_code = x.state_code
  from public.jhadina_public_jurisdictions x
 where x.id = j.jurisdiction_id
   and j.state_code is distinct from x.state_code;

create index if not exists jhadina_public_source_discovery_jobs_state_queue_idx
  on public.jhadina_public_source_discovery_jobs (state_code, status, priority, attempt_count, updated_at);

alter table public.jhadina_public_procurement_sources
  add column if not exists state_code text;

update public.jhadina_public_procurement_sources s
   set state_code = x.state_code
  from public.jhadina_public_jurisdictions x
 where x.id = s.jurisdiction_id
   and s.state_code is distinct from x.state_code;

create index if not exists jhadina_public_procurement_sources_state_queue_idx
  on public.jhadina_public_procurement_sources (state_code, adapter_status, last_adapter_trial_at);

alter table public.jhadina_public_work_packages
  add column if not exists provider_discovery_at timestamptz;

create index if not exists jhadina_public_work_packages_provider_discovery_idx
  on public.jhadina_public_work_packages (provider_discovery_at, updated_at)
  where status in ('candidate','review_required');

revoke all on table public.jhadina_public_source_discovery_jobs from anon, authenticated;
revoke all on table public.jhadina_public_procurement_sources from anon, authenticated;
revoke all on table public.jhadina_public_work_packages from anon, authenticated;
grant all on table public.jhadina_public_source_discovery_jobs to service_role;
grant all on table public.jhadina_public_procurement_sources to service_role;
grant all on table public.jhadina_public_work_packages to service_role;
