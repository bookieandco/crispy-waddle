create table if not exists public.staffing_applications (
  id text primary key,
  organization_id uuid not null,
  job_id text not null references public.staffing_marketplace_jobs(id),
  worker_id uuid not null,
  status text not null check (status in ('SUBMITTED','WITHDRAWN','REJECTED','ADVANCING','HIRED')),
  cover_note text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists staffing_applications_active_worker_job_idx
  on public.staffing_applications (job_id, worker_id)
  where status <> 'WITHDRAWN';

create index if not exists staffing_applications_employer_pipeline_idx
  on public.staffing_applications (organization_id, status, created_at desc);

alter table public.staffing_applications enable row level security;

create policy "staffing applications organization access" on public.staffing_applications
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
