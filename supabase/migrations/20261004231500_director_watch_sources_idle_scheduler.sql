-- Autonomous Director Watch source subscriptions.
-- Sources must be explicitly authorized. Idle scheduler may enqueue observation jobs only;
-- it grants no publishing, financial, wagering, or canonical-reality authority.

create table if not exists public.director_watch_sources (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null check (purpose in ('creative','sports')),
  label text not null,
  media_type text check (media_type is null or media_type in ('youtube','movie','music','jhadina_work','tv')),
  media_id text,
  event_id text,
  subject_id text,
  source_kind text not null check (source_kind in (
    'hls','dash','authorized-stream','homebase-capture','local-file','rtsp','capture'
  )),
  source_locator text not null,
  execution_target text not null default 'cloud'
    check (execution_target in ('cloud','homebase')),
  enabled boolean not null default true,
  rights_verified boolean not null default false,
  source_authorized boolean not null default false,
  cadence_minutes integer not null default 180 check (cadence_minutes between 15 and 10080),
  sample_every_seconds numeric not null default 8 check (sample_every_seconds between 1 and 120),
  max_frames integer not null default 120 check (max_frames between 1 and 600),
  priority integer not null default 10 check (priority between 0 and 100),
  next_due_at timestamptz not null default now(),
  last_dispatched_at timestamptz,
  last_completed_at timestamptz,
  last_job_id text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (purpose='creative' and media_id is not null)
    or
    (purpose='sports' and event_id is not null and subject_id is not null)
  )
);

create index if not exists director_watch_sources_due_idx
  on public.director_watch_sources(enabled,next_due_at,priority desc)
  where enabled=true;

create index if not exists director_watch_sources_owner_idx
  on public.director_watch_sources(owner_user_id,updated_at desc);

alter table public.director_watch_sources enable row level security;
revoke all on public.director_watch_sources from public,anon,authenticated;
grant select,insert,update,delete on public.director_watch_sources to service_role;

drop policy if exists director_watch_sources_service_role_only on public.director_watch_sources;
create policy director_watch_sources_service_role_only
  on public.director_watch_sources
  as restrictive for all to service_role
  using (true) with check (true);

alter table public.director_watch_jobs
  add column if not exists source_subscription_id text references public.director_watch_sources(id) on delete set null,
  add column if not exists low_priority_background boolean not null default false;

comment on table public.director_watch_sources is
'Explicitly authorized recurring TV/video/game study sources. Scheduler may enqueue observation-only work when capacity is idle. DRM/paywall bypass is outside this contract.';
