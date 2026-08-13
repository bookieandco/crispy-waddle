create table if not exists public.staffing_candidate_reviews (
  id text primary key,
  organization_id uuid not null,
  application_id text not null references public.staffing_applications(id),
  reviewer_id text not null,
  decision text not null check (decision in ('ADVANCE','REFER','HOLD','REJECT')),
  note text,
  created_at timestamptz not null
);

create index if not exists staffing_candidate_reviews_application_idx
  on public.staffing_candidate_reviews (application_id, created_at desc);

create index if not exists staffing_candidate_reviews_org_idx
  on public.staffing_candidate_reviews (organization_id, created_at desc);

alter table public.staffing_candidate_reviews enable row level security;

create policy "staffing candidate reviews organization access" on public.staffing_candidate_reviews
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
