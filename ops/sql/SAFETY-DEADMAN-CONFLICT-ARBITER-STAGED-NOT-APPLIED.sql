-- SAFETY-P0 / #1224: REVIEW-ONLY patch for the independent deadman cron SQL defect.
-- NOT a Supabase migration. NOT applied to SWLC.
-- Once capacity/read-write and verified backup gates pass, create an actual
-- timestamped migration using `supabase migration new safety_deadman_conflict_arbiter`
-- and move this reviewed change into that generated file.
--
-- Root cause: RETURNS TABLE names `incident_id` as a PL/pgSQL output variable.
-- An unqualified ON CONFLICT (incident_id) is therefore ambiguous.
-- Pinning the *existing, independently verified* primary-key constraint preserves
-- the same conflict target without changing the result shape, RLS or lease policy.

create or replace function public.claim_due_jhadina_safety_incidents(
  p_now timestamptz,
  p_lease_seconds integer default 120,
  p_limit integer default 50
)
returns table(incident_id text, lease_id uuid, leased_until timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  with due as (
    select i.incident_id
    from public.jhadina_safety_incidents i
    left join public.jhadina_safety_deadman_leases l using (incident_id)
    where i.deadline_at is not null
      and i.deadline_at <= p_now
      and i.dead_man_state not in ('resolved', 'cancelled', 'disarmed')
      and (l.leased_until is null or l.leased_until <= p_now)
    order by i.deadline_at, i.incident_id
    for update of i skip locked
    limit greatest(1, least(p_limit, 100))
  ), claimed as (
    insert into public.jhadina_safety_deadman_leases as l
      (incident_id, lease_id, leased_until, completed_at, updated_at)
    select d.incident_id, gen_random_uuid(),
           p_now + make_interval(secs => p_lease_seconds), null, p_now
    from due d
    on conflict on constraint jhadina_safety_deadman_leases_pkey do update
      set lease_id = excluded.lease_id,
          leased_until = excluded.leased_until,
          completed_at = null,
          updated_at = excluded.updated_at
    returning l.incident_id, l.lease_id, l.leased_until
  )
  select claimed.incident_id, claimed.lease_id, claimed.leased_until from claimed;
end;
$function$;

-- Explicitly preserve the originally reviewed privileged executor boundary.
revoke all on function public.claim_due_jhadina_safety_incidents(timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_jhadina_safety_incidents(timestamptz, integer, integer)
  to service_role;
