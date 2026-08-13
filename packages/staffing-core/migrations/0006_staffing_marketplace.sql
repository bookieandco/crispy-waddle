create table if not exists public.staffing_marketplace_jobs (
  id text primary key,
  organization_id uuid not null,
  employer_id uuid not null,
  title text not null,
  description text not null,
  location text not null,
  pay_rate numeric(14,2) not null check (pay_rate > 0),
  currency text not null check (char_length(currency) = 3),
  remote boolean not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  source_event_id text not null unique,
  marketplace_published_at timestamptz not null
);

create index if not exists staffing_marketplace_jobs_feed_idx
  on public.staffing_marketplace_jobs (status, created_at desc);

create table if not exists public.staffing_marketplace_event_receipts (
  event_id text primary key,
  processed_at timestamptz not null
);

alter table public.staffing_marketplace_jobs enable row level security;
alter table public.staffing_marketplace_event_receipts enable row level security;

create policy "staffing marketplace organization access" on public.staffing_marketplace_jobs
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
