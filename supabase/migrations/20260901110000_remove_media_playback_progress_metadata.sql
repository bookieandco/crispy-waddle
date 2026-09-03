alter table public.media_playback_progress
  drop column if exists metadata;

revoke execute on function public.upsert_media_playback_progress(
  text,text,text,text,bigint,bigint,boolean,timestamptz,jsonb
) from public, anon, authenticated;

drop function if exists public.upsert_media_playback_progress(
  text,text,text,text,bigint,bigint,boolean,timestamptz,jsonb
);

create or replace function public.upsert_media_playback_progress(
  p_id text,
  p_user_id text,
  p_provider_id text,
  p_media_id text,
  p_position_ms bigint,
  p_duration_ms bigint,
  p_completed boolean,
  p_updated_at timestamptz
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
    id, user_id, provider_id, media_id,
    position_ms, duration_ms, completed, updated_at
  )
  values (
    p_id, p_user_id, p_provider_id, p_media_id,
    greatest(0, p_position_ms),
    case when p_duration_ms is null then null else greatest(0, p_duration_ms) end,
    p_completed, p_updated_at
  )
  on conflict (user_id, provider_id, media_id)
  do update set
    position_ms = excluded.position_ms,
    duration_ms = excluded.duration_ms,
    completed = excluded.completed,
    updated_at = excluded.updated_at
  where excluded.updated_at > public.media_playback_progress.updated_at
  returning * into result;

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
  text,text,text,text,bigint,bigint,boolean,timestamptz
) from public, anon, authenticated;

grant execute on function public.upsert_media_playback_progress(
  text,text,text,text,bigint,bigint,boolean,timestamptz
) to service_role;
