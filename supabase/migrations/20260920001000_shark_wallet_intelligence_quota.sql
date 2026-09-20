-- SHARK-QA.16H: authenticated users must not have unbounded access to paid providers.
create table if not exists public.jhadina_shark_wallet_intelligence_quota (
  user_id uuid not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, window_start)
);

alter table public.jhadina_shark_wallet_intelligence_quota enable row level security;
revoke all on public.jhadina_shark_wallet_intelligence_quota from public, anon, authenticated;
grant select, insert, update, delete on public.jhadina_shark_wallet_intelligence_quota to service_role;

create or replace function public.jhadina_shark_consume_wallet_intelligence_quota(
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_user_id is null or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.jhadina_shark_wallet_intelligence_quota(user_id, window_start, request_count)
  values (p_user_id, v_window, 1)
  on conflict (user_id, window_start) do update
    set request_count = jhadina_shark_wallet_intelligence_quota.request_count + 1
  returning request_count into v_count;

  delete from public.jhadina_shark_wallet_intelligence_quota
  where window_start < now() - interval '1 day';

  return v_count <= p_limit;
end;
$$;

revoke all on function public.jhadina_shark_consume_wallet_intelligence_quota(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.jhadina_shark_consume_wallet_intelligence_quota(uuid, integer, integer)
  to service_role;
