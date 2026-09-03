-- Jhadina Personality Core v2 durable state.
--
-- Personality is learned state, not a prompt. Keep the durable projection
-- append-only and versioned so every accepted personality revision remains
-- reconstructable and optimistic concurrency can reject stale writers.
--
-- Access model follows the current Jhadina memory-core boundary: until real
-- end-user identity is authoritative, personality persistence is service-role
-- only and must never be exposed to browser clients.

create table if not exists public.jhadina_personality_states (
  profile_id text not null,
  version integer not null check (version >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  primary key (profile_id, version)
);

create index if not exists jhadina_personality_states_latest_idx
  on public.jhadina_personality_states (profile_id, version desc);

alter table public.jhadina_personality_states enable row level security;

create policy jhadina_personality_states_service_role_only
  on public.jhadina_personality_states as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_personality_states from anon, authenticated;

create or replace function public.jhadina_save_personality_state(
  p_profile_id text,
  p_expected_version integer,
  p_next_state jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version integer;
  next_version integer;
begin
  if p_profile_id is null or btrim(p_profile_id) = '' then
    raise exception 'personality profile_id is required';
  end if;

  if jsonb_typeof(p_next_state) <> 'object' then
    raise exception 'personality state must be a JSON object';
  end if;

  select s.version
    into current_version
    from public.jhadina_personality_states s
   where s.profile_id = p_profile_id
   order by s.version desc
   limit 1
   for update;

  current_version := coalesce(current_version, -1);
  if current_version <> p_expected_version then
    raise exception 'personality version conflict: expected %, actual %',
      p_expected_version, current_version
      using errcode = '40001';
  end if;

  next_version := p_expected_version + 1;

  if coalesce((p_next_state ->> 'version')::integer, -1) <> next_version then
    raise exception 'personality state version must equal expected_version + 1';
  end if;

  insert into public.jhadina_personality_states (
    profile_id,
    version,
    state
  ) values (
    p_profile_id,
    next_version,
    p_next_state
  );

  return next_version;
end;
$$;

revoke execute on function public.jhadina_save_personality_state(text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.jhadina_save_personality_state(text, integer, jsonb)
  to service_role;
