create table if not exists public.jhadina_safety_deadman_leases (
  incident_id text primary key references public.jhadina_safety_incidents(incident_id) on delete cascade,
  lease_id uuid,
  leased_until timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_safety_delivery_receipts (
  idempotency_key text primary key,
  incident_id text not null references public.jhadina_safety_incidents(incident_id) on delete cascade,
  recipient_id text not null,
  channel text not null check (channel in ('push','sms','email','call')),
  accepted boolean not null default false,
  provider_reference text,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  retryable boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.jhadina_safety_deadman_leases enable row level security;
alter table public.jhadina_safety_delivery_receipts enable row level security;

create or replace function public.claim_due_jhadina_safety_incidents(
  p_now timestamptz,
  p_lease_seconds integer default 120,
  p_limit integer default 50
)
returns table(incident_id text, lease_id uuid, leased_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select i.incident_id
    from public.jhadina_safety_incidents i
    left join public.jhadina_safety_deadman_leases l using (incident_id)
    where i.deadline_at is not null
      and i.deadline_at <= p_now
      and i.dead_man_state not in ('resolved','cancelled','disarmed')
      and (l.leased_until is null or l.leased_until <= p_now)
    order by i.deadline_at, i.incident_id
    for update of i skip locked
    limit greatest(1, least(p_limit, 100))
  ), claimed as (
    insert into public.jhadina_safety_deadman_leases as l
      (incident_id, lease_id, leased_until, completed_at, updated_at)
    select d.incident_id, gen_random_uuid(), p_now + make_interval(secs => p_lease_seconds), null, p_now
    from due d
    on conflict (incident_id) do update
      set lease_id = excluded.lease_id,
          leased_until = excluded.leased_until,
          completed_at = null,
          updated_at = excluded.updated_at
    returning l.incident_id, l.lease_id, l.leased_until
  )
  select claimed.incident_id, claimed.lease_id, claimed.leased_until from claimed;
end;
$$;

revoke all on function public.claim_due_jhadina_safety_incidents(timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_due_jhadina_safety_incidents(timestamptz, integer, integer) to service_role;
