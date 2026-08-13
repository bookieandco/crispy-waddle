create table if not exists public.staffing_candidate_pipeline (
  application_id text primary key references public.staffing_applications(id),
  organization_id uuid not null,
  job_id text not null,
  worker_id uuid not null,
  stage text not null check (stage in ('NEW','REVIEW','SHORTLIST','INTERVIEW','OFFER','PLACEMENT','REJECTED')),
  note text not null default '',
  updated_at timestamptz not null
);

create index if not exists staffing_candidate_pipeline_org_stage_idx
  on public.staffing_candidate_pipeline (organization_id, stage, updated_at desc);

create policy "staffing candidate pipeline organization access" on public.staffing_candidate_pipeline
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
