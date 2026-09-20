-- SHARK-QA.17E: prioritize launches with no historical observation, then the
-- launch whose newest persisted evidence is stalest. Attempt time only breaks
-- ties, preventing high-churn/new launches from monopolizing the worker.

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
  with latest_observation as (
    select o.launch_id, max(o.observed_at) as latest_observed_at
    from public.jhadina_launch_outcome_observations o
    group by o.launch_id
  ),
  candidates as (
    select
      s.launch_id,
      lo.latest_observed_at,
      l.launched_at
    from public.jhadina_shark_historical_backfill_schedule s
    join public.jhadina_token_launches l on l.launch_id = s.launch_id
    left join latest_observation lo on lo.launch_id = s.launch_id
    order by
      (lo.latest_observed_at is not null) asc,
      lo.latest_observed_at asc nulls first,
      s.last_attempted_at asc nulls first,
      l.launched_at asc,
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
  order by l.launched_at asc, l.launch_id;
end;
$$;

revoke all on function public.jhadina_shark_claim_historical_backfill(integer)
  from public, anon, authenticated;
grant execute on function public.jhadina_shark_claim_historical_backfill(integer)
  to service_role;
