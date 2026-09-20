-- SHARK-QA.16B: durable, fair scheduling for historical evidence refresh.
-- Newest-first scans can permanently starve older launches. Track attempts and
-- rotate least-recently-attempted launches through the hourly worker.

create table if not exists public.jhadina_shark_historical_backfill_schedule (
  launch_id text primary key references public.jhadina_token_launches(launch_id) on delete cascade,
  last_attempted_at timestamptz,
  last_succeeded_at timestamptz,
  attempt_count bigint not null default 0 check (attempt_count >= 0),
  failure_count bigint not null default 0 check (failure_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_shark_historical_backfill_schedule_attempt_idx
  on public.jhadina_shark_historical_backfill_schedule (last_attempted_at asc nulls first, launch_id);

alter table public.jhadina_shark_historical_backfill_schedule enable row level security;
revoke all on public.jhadina_shark_historical_backfill_schedule from public, anon, authenticated;
grant select, insert, update, delete on public.jhadina_shark_historical_backfill_schedule to service_role;

create or replace function public.jhadina_shark_claim_historical_backfill(
  p_limit integer
)
returns setof public.jhadina_token_launches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid historical backfill limit';
  end if;

  insert into public.jhadina_shark_historical_backfill_schedule (launch_id)
  select l.launch_id
  from public.jhadina_token_launches l
  on conflict (launch_id) do nothing;

  return query
  with candidates as (
    select s.launch_id
    from public.jhadina_shark_historical_backfill_schedule s
    join public.jhadina_token_launches l on l.launch_id = s.launch_id
    order by
      s.last_attempted_at asc nulls first,
      s.last_succeeded_at asc nulls first,
      l.launched_at desc,
      s.launch_id
    limit p_limit
    for update of s skip locked
  ),
  claimed as (
    update public.jhadina_shark_historical_backfill_schedule s
       set last_attempted_at = now(),
           attempt_count = s.attempt_count + 1,
           updated_at = now()
      from candidates c
     where s.launch_id = c.launch_id
    returning s.launch_id
  )
  select l.*
  from public.jhadina_token_launches l
  join claimed c on c.launch_id = l.launch_id
  order by l.launched_at desc, l.launch_id;
end;
$$;

revoke all on function public.jhadina_shark_claim_historical_backfill(integer)
  from public, anon, authenticated;
grant execute on function public.jhadina_shark_claim_historical_backfill(integer)
  to service_role;


create or replace function public.jhadina_shark_record_historical_backfill_failure(
  p_launch_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.jhadina_shark_historical_backfill_schedule
     set failure_count = failure_count + 1,
         updated_at = now()
   where launch_id = p_launch_id;

  if not found then
    raise exception 'unknown SHARK historical backfill launch';
  end if;
end;
$$;

revoke all on function public.jhadina_shark_record_historical_backfill_failure(text)
  from public, anon, authenticated;
grant execute on function public.jhadina_shark_record_historical_backfill_failure(text)
  to service_role;
