-- Jhadina Media Core: make playback progress writes monotonic at the database boundary.
--
-- The unique key serializes concurrent writes for the same user/provider/media
-- tuple. The conflict WHERE clause is the authoritative freshness rule:
-- only a strictly newer updated_at may replace the stored progress.

create or replace function public.upsert_media_playback_progress(
  p_id text,
  p_user_id text,
  p_provider_id text,
  p_media_id text,
  p_position_ms bigint,
  p_duration_ms bigint,
  p_completed boolean,
  p_updated_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns public.media_playback_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.media_playback_progress;
begin
  insert into public.media_playback_progress (
    id,
    user_id,
    provider_id,
    media_id,
    position_ms,
    duration_ms,
    completed,
    updated_at,
    metadata
  )
  values (
    p_id,
    p_user_id,
    p_provider_id,
    p_media_id,
    greatest(0, p_position_ms),
    case when p_duration_ms is null then null else greatest(0, p_duration_ms) end,
    p_completed,
    p_updated_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, provider_id, media_id)
  do update set
    position_ms = excluded.position_ms,
    duration_ms = excluded.duration_ms,
    completed = excluded.completed,
    updated_at = excluded.updated_at,
    metadata = excluded.metadata
  where excluded.updated_at > public.media_playback_progress.updated_at
  returning * into result;

  -- A stale/equal write performs no UPDATE. Return the existing winner so the
  -- repository always receives the authoritative persisted state.
  if not found then
    select * into result
    from public.media_playback_progress
    where user_id = p_user_id
      and provider_id = p_provider_id
      and media_id = p_media_id;
  end if;

  return result;
end;
$$;

revoke execute on function public.upsert_media_playback_progress(
  text, text, text, text, bigint, bigint, boolean, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.upsert_media_playback_progress(
  text, text, text, text, bigint, bigint, boolean, timestamptz, jsonb
) to service_role;
