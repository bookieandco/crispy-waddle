create table if not exists public.staffing_interview_outcomes (
  id text primary key,
  organization_id uuid not null,
  interview_id text not null references public.staffing_interviews(id),
  application_id text not null references public.staffing_applications(id),
  employer_user_id text not null,
  outcome text not null check (outcome in ('PASS','HOLD','FAIL')),
  note text,
  created_at timestamptz not null
);

create unique index if not exists staffing_interview_outcomes_interview_once_idx on public.staffing_interview_outcomes (interview_id);
create index if not exists staffing_interview_outcomes_org_idx on public.staffing_interview_outcomes (organization_id, created_at desc);

alter table public.staffing_interview_outcomes enable row level security;
create policy "staffing interview outcomes organization access" on public.staffing_interview_outcomes
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
