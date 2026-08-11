create table if not exists public.staffing_interviews (
  id text primary key,
  organization_id uuid not null,
  application_id text not null references public.staffing_applications(id),
  created_by text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  location text,
  meeting_url text,
  status text not null check (status in ('SCHEDULED','CANCELLED')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (ends_at > starts_at)
);

create index if not exists staffing_interviews_org_time_idx on public.staffing_interviews (organization_id, starts_at);
create index if not exists staffing_interviews_application_idx on public.staffing_interviews (application_id, starts_at desc);

alter table public.staffing_interviews enable row level security;
create policy "staffing interviews organization access" on public.staffing_interviews
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
