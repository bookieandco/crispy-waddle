-- Durable commissioning evidence for the shared Director Watch worker.

create table if not exists public.director_watch_commissioning_receipts (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.director_watch_jobs(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null check (purpose in ('creative','sports','take-qc')),
  provider_id text not null,
  source_kind text not null,
  callback_verified boolean not null,
  result_count integer not null check (result_count >= 0),
  persisted_result_count integer not null check (persisted_result_count >= 0),
  status text not null check (status in ('passed','failed')),
  error text,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(job_id)
);

create index if not exists director_watch_commissioning_purpose_idx
  on public.director_watch_commissioning_receipts(purpose,completed_at desc);

alter table public.director_watch_commissioning_receipts enable row level security;
revoke all on public.director_watch_commissioning_receipts from public,anon,authenticated;
grant select,insert,update on public.director_watch_commissioning_receipts to service_role;

drop policy if exists director_watch_commissioning_receipts_service_role_only on public.director_watch_commissioning_receipts;
create policy director_watch_commissioning_receipts_service_role_only
  on public.director_watch_commissioning_receipts
  as restrictive for all to service_role using (true) with check (true);

comment on table public.director_watch_commissioning_receipts is
'Authenticated end-to-end Director Watch callback receipts. A passed receipt proves the worker returned and persisted evidence; it does not grant creative, sports-reality, wagering, publication, or financial authority.';
