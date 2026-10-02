-- LOCAL-GOV.PROD — isolate repaired convergence queues from obsolete workers.

alter table public.jhadina_public_source_discovery_jobs
  drop constraint if exists jhadina_public_source_discovery_jobs_status_check;

alter table public.jhadina_public_source_discovery_jobs
  add constraint jhadina_public_source_discovery_jobs_status_check
  check (status = any (array[
    'pending'::text,
    'discovered'::text,
    'adapter_required'::text,
    'active'::text,
    'blocked'::text,
    'deferred'::text
  ]));

alter table public.jhadina_public_procurement_sources
  drop constraint if exists jhadina_public_procurement_sources_adapter_status_check;

alter table public.jhadina_public_procurement_sources
  add constraint jhadina_public_procurement_sources_adapter_status_check
  check (adapter_status = any (array[
    'adapter_required'::text,
    'active'::text,
    'degraded'::text,
    'disabled'::text,
    'deferred'::text
  ]));

update public.jhadina_public_source_discovery_jobs
set status='deferred',
    updated_at=now()
where status='blocked'
  and last_error='deferred_to_source_v2_convergence';

update public.jhadina_public_procurement_sources
set adapter_status='deferred',
    updated_at=now()
where adapter_status='degraded'
  and 'deferred_to_adapter_v1_1_convergence'=any(blockers);
