-- MUSIC-DEVICE.15: user-scoped cross-device resume ledger.
-- Deploy only after reviewing existing SWLC migrations and confirming auth+RLS.
create table if not exists public.music_playback_checkpoints (
  user_id text not null,
  track_id text not null,
  position_ms bigint not null default 0 check (position_ms >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
create index if not exists music_playback_checkpoints_recent
  on public.music_playback_checkpoints(user_id, updated_at desc);

alter table public.music_playback_checkpoints enable row level security;
create policy "music checkpoint select own" on public.music_playback_checkpoints
  for select to authenticated using (user_id = auth.uid()::text);
create policy "music checkpoint insert own" on public.music_playback_checkpoints
  for insert to authenticated with check (user_id = auth.uid()::text);
create policy "music checkpoint update own" on public.music_playback_checkpoints
  for update to authenticated using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
-- No public/anon writes or service-role fallback. Identity is derived from auth.
