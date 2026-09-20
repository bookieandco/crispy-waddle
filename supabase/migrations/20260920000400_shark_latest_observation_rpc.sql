-- SHARK-QA.16B: avoid global observation-window starvation.
-- Return at most one latest observation for every requested launch.
create or replace function public.jhadina_shark_latest_outcome_observations(
  p_launch_ids text[]
)
returns setof public.jhadina_launch_outcome_observations
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct on (o.launch_id) o.*
  from public.jhadina_launch_outcome_observations o
  where o.launch_id = any(p_launch_ids)
  order by o.launch_id, o.observed_at desc, o.observation_id desc;
$$;

revoke all on function public.jhadina_shark_latest_outcome_observations(text[])
  from public, anon, authenticated;
grant execute on function public.jhadina_shark_latest_outcome_observations(text[])
  to service_role;
