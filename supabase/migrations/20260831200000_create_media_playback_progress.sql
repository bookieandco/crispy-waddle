-- Jhadina Media Core playback progress.
--
-- Identity note: the application does not yet have a real end-user Supabase
-- Auth session. Follow the established Jhadina persistence convention:
-- user_id is supplied by the application boundary and ownership is enforced
-- by the repository layer. Until real Identity/Auth exists, expose this table
-- only to service_role rather than pretending auth.uid() provides isolation.

create table if not exists public.media_playback_progress (
  id text primary key,
  user_id text not null,
  provider_id text not null,
  media_id text not null,
  position_ms bigint not null default 0 check (position_ms >= 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, provider_id, media_id)
);

create index if not exists media_playback_progress_user_idx
  on public.media_playback_progress (user_id, updated_at desc);

alter table public.media_playback_progress enable row level security;

create policy media_playback_progress_service_role_only
  on public.media_playback_progress as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.media_playback_progress from anon, authenticated;
