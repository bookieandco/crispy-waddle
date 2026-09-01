alter table public.oce_alert_deliveries
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text;

create index if not exists oce_alert_deliveries_claim_idx
  on public.oce_alert_deliveries (status, next_attempt_at, claimed_at)
  where status in ('PENDING', 'RETRYING');

create or replace function public.claim_oce_alert_deliveries(
  p_now timestamptz,
  p_worker_id text,
  p_limit integer default 25
)
returns setof public.oce_alert_deliveries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select d.id
    from public.oce_alert_deliveries d
    where d.status in ('PENDING', 'RETRYING')
      and coalesce(d.next_attempt_at, d.created_at) <= p_now
      and (d.claimed_at is null or d.claimed_at < p_now - interval '10 minutes')
      and d.attempt < d.max_attempts
    order by d.priority desc, coalesce(d.next_attempt_at, d.created_at), d.created_at, d.id
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update public.oce_alert_deliveries d
     set claimed_at = p_now,
         claimed_by = p_worker_id,
         updated_at = p_now
    from candidates c
   where d.id = c.id
  returning d.*;
end;
$$;

revoke all on function public.claim_oce_alert_deliveries(timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.claim_oce_alert_deliveries(timestamptz, text, integer) to service_role;
