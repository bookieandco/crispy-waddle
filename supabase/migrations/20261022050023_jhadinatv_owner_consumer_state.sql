-- JTV-PRIVATE.FINISH.11: owner-scoped resume/watchlist.
-- Applied to canonical SWLC on 2026-10-21/22 as migration version 20261022050023.
-- Production migration history must match this filename; still requires live two-user RLS canary.
create table if not exists public.jtv_playback_checkpoints (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id text not null check (char_length(media_id) between 1 and 220),
  position_seconds double precision not null check (position_seconds >= 0 and position_seconds < 10000000),
  duration_seconds double precision check (duration_seconds > 0 and duration_seconds < 10000000),
  completed boolean not null default false,
  observed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id)
);
create table if not exists public.jtv_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id text not null check (char_length(media_id) between 1 and 220),
  added_at timestamptz not null default now(),
  primary key (user_id, media_id)
);
alter table public.jtv_playback_checkpoints enable row level security;
alter table public.jtv_watchlist enable row level security;
revoke all on public.jtv_playback_checkpoints, public.jtv_watchlist from anon;
grant select, insert, update, delete on public.jtv_playback_checkpoints, public.jtv_watchlist to authenticated;
create policy "jtv checkpoints owner read" on public.jtv_playback_checkpoints
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "jtv checkpoints owner insert" on public.jtv_playback_checkpoints
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "jtv checkpoints owner update" on public.jtv_playback_checkpoints
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "jtv checkpoints owner delete" on public.jtv_playback_checkpoints
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "jtv watchlist owner read" on public.jtv_watchlist
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "jtv watchlist owner insert" on public.jtv_watchlist
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "jtv watchlist owner update" on public.jtv_watchlist
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "jtv watchlist owner delete" on public.jtv_watchlist
  for delete to authenticated using ((select auth.uid()) = user_id);
-- Never let an older delayed device checkpoint roll back a newer position.
create or replace function public.jtv_record_checkpoint(
  p_media_id text, p_position_seconds double precision,
  p_duration_seconds double precision, p_observed_at timestamptz
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'JhadinaTV owner sign-in required'; end if;
  if p_media_id is null or length(p_media_id) < 1 or length(p_media_id) > 220 or
     p_media_id !~ '^jellyfin(-live)?:[A-Za-z0-9._:-]+$' or
     p_position_seconds is null or p_position_seconds < 0 or p_position_seconds >= 10000000 or
     (p_duration_seconds is not null and (p_duration_seconds <= 0 or p_duration_seconds >= 10000000)) or
     p_observed_at is null or p_observed_at > now() + interval '2 minutes' or
     p_observed_at < now() - interval '30 days'
  then raise exception 'Invalid JhadinaTV checkpoint'; end if;
  insert into public.jtv_playback_checkpoints
      (user_id, media_id, position_seconds, duration_seconds, completed, observed_at)
  values (v_user_id, p_media_id, p_position_seconds, p_duration_seconds,
      coalesce(p_duration_seconds > 0 and p_position_seconds >= p_duration_seconds * 0.95, false), p_observed_at)
  on conflict (user_id, media_id) do update
    set position_seconds=excluded.position_seconds,
        duration_seconds=excluded.duration_seconds,
        completed=excluded.completed,
        observed_at=excluded.observed_at,
        updated_at=now()
    where excluded.observed_at > public.jtv_playback_checkpoints.observed_at;
end $$;
revoke all on function public.jtv_record_checkpoint(text,double precision,double precision,timestamptz) from public;
grant execute on function public.jtv_record_checkpoint(text,double precision,double precision,timestamptz) to authenticated;
