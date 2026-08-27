-- Defense-in-depth owner filtering for Experience reads.
-- The application adapter MUST supply user_id from ExperienceScope.ownerId.
-- This view exposes only rows for an explicitly supplied owner through the
-- existing database session setting; it is intentionally not a substitute
-- for RLS once Jhadina Identity is wired to auth.uid().

create index if not exists jhadina_experience_events_user_event_idx
  on public.jhadina_experience_events (user_id, id);

create or replace function public.list_jhadina_experience_events(p_user_id text)
returns setof public.jhadina_experience_events
language sql
stable
security invoker
set search_path = public
as $$
  select e.*
  from public.jhadina_experience_events e
  where e.user_id = p_user_id
  order by e.recorded_at desc, e.id asc;
$$;

revoke all on function public.list_jhadina_experience_events(text) from public;
grant execute on function public.list_jhadina_experience_events(text) to service_role;
