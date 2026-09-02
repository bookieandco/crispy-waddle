create table if not exists public.jhadina_security_kill_switch (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  changed_at timestamptz not null default now(),
  reason text not null default 'initial',
  actor_id uuid,
  version bigint not null default 0 check (version >= 0)
);

insert into public.jhadina_security_kill_switch (singleton, enabled, changed_at, reason, actor_id, version)
values (true, false, now(), 'initial', null, 0)
on conflict (singleton) do nothing;

alter table public.jhadina_security_kill_switch enable row level security;

revoke all on table public.jhadina_security_kill_switch from anon, authenticated;
grant select on table public.jhadina_security_kill_switch to authenticated;

create policy "authenticated may read security kill switch"
on public.jhadina_security_kill_switch
for select
to authenticated
using (true);

create or replace function public.read_jhadina_security_kill_switch()
returns table (
  enabled boolean,
  changed_at timestamptz,
  reason text,
  actor_id uuid,
  version bigint
)
language sql
security invoker
stable
as $$
  select enabled, changed_at, reason, actor_id, version
  from public.jhadina_security_kill_switch
  where singleton = true;
$$;

create or replace function public.transition_jhadina_security_kill_switch(
  p_enabled boolean,
  p_reason text,
  p_expected_version bigint
)
returns table (
  enabled boolean,
  changed_at timestamptz,
  reason text,
  actor_id uuid,
  version bigint
)
language plpgsql
security invoker
volatile
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'KILL_SWITCH_AUTH_REQUIRED';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'KILL_SWITCH_REASON_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'KILL_SWITCH_VERSION_INVALID';
  end if;

  update public.jhadina_security_kill_switch
     set enabled = p_enabled,
         changed_at = v_now,
         reason = left(btrim(p_reason), 500),
         actor_id = v_actor,
         version = version + 1
   where singleton = true
     and version = p_expected_version;

  if not found then
    raise exception 'KILL_SWITCH_VERSION_CONFLICT';
  end if;

  return query
    select s.enabled, s.changed_at, s.reason, s.actor_id, s.version
    from public.jhadina_security_kill_switch s
    where s.singleton = true;
end;
$$;

revoke execute on function public.read_jhadina_security_kill_switch() from public, anon;
grant execute on function public.read_jhadina_security_kill_switch() to authenticated;
revoke execute on function public.transition_jhadina_security_kill_switch(boolean, text, bigint) from public, anon;
grant execute on function public.transition_jhadina_security_kill_switch(boolean, text, bigint) to authenticated;
