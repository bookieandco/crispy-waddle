create table if not exists public.staffing_employer_decisions (
  id text primary key,
  organization_id uuid not null,
  application_id text not null references public.staffing_applications(id),
  employer_user_id text not null,
  decision text not null check (decision in ('INTERVIEW','HOLD','DECLINE')),
  note text,
  created_at timestamptz not null
);

create index if not exists staffing_employer_decisions_application_idx
  on public.staffing_employer_decisions (application_id, created_at desc);

create index if not exists staffing_employer_decisions_org_idx
  on public.staffing_employer_decisions (organization_id, created_at desc);

alter table public.staffing_employer_decisions enable row level security;

create policy "staffing employer decisions organization access" on public.staffing_employer_decisions
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
