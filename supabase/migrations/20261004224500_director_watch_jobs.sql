-- Durable asynchronous Director Watch jobs for creative study and sports perception.
-- Sources must be authorized before dispatch. Results remain observation/intelligence only.

create table if not exists public.director_watch_jobs (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null check (purpose in ('creative','sports')),
  media_id text,
  event_id text,
  subject_id text,
  source_kind text not null check (source_kind in ('local-file','hls','dash','rtsp','capture','authorized-stream')),
  source_locator text not null,
  status text not null check (status in ('queued','submitted','running','completed','blocked','failed','cancelled')),
  provider_id text,
  request jsonb not null default '{}'::jsonb,
  result_count integer not null default 0 check (result_count >= 0),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists director_watch_jobs_owner_idx
  on public.director_watch_jobs(owner_user_id, updated_at desc);
create index if not exists director_watch_jobs_status_idx
  on public.director_watch_jobs(status, updated_at);

alter table public.director_watch_jobs enable row level security;
revoke all on public.director_watch_jobs from public,anon,authenticated;
grant select,insert,update on public.director_watch_jobs to service_role;

drop policy if exists director_watch_jobs_service_role_only on public.director_watch_jobs;
create policy director_watch_jobs_service_role_only
  on public.director_watch_jobs
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_watch_jobs is
'Asynchronous authorized-media perception queue. Creative results are observations/taste evidence; sports results are DIRECTOR_INFERENCE_ONLY and cannot establish official reality or authorize wagers.';
