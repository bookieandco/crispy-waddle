-- Credential leases contain references and bindings only; secret material is never
-- persisted in this table. Consumption is an atomic delete, so a lease can be
-- used exactly once across multiple application instances.
create table if not exists public.jhadina_credential_lease (
  lease_id uuid primary key,
  actor_id text not null,
  worker_id text not null,
  domain text not null,
  capability text not null,
  credential_ref text not null,
  resource_id text,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_credential_lease_expiry_idx
  on public.jhadina_credential_lease (expires_at);

alter table public.jhadina_credential_lease enable row level security;
revoke all on public.jhadina_credential_lease from public, anon, authenticated;

create or replace function public.issue_jhadina_credential_lease(
  p_lease_id uuid,
  p_actor_id text,
  p_worker_id text,
  p_domain text,
  p_capability text,
  p_credential_ref text,
  p_resource_id text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or auth.uid()::text <> p_actor_id then
    raise exception 'credential lease actor must match the authenticated caller';
  end if;
  if p_expires_at <= p_issued_at then
    raise exception 'credential lease expiry must be after issue time';
  end if;
  if p_expires_at > p_issued_at + interval '60 seconds' then
    raise exception 'credential lease exceeds maximum ttl';
  end if;
  insert into public.jhadina_credential_lease
    (lease_id, actor_id, worker_id, domain, capability, credential_ref, resource_id, issued_at, expires_at)
  values
    (p_lease_id, p_actor_id, p_worker_id, p_domain, p_capability, p_credential_ref, p_resource_id, p_issued_at, p_expires_at);
end;
$$;

create or replace function public.consume_jhadina_credential_lease(
  p_lease_id uuid,
  p_actor_id text,
  p_worker_id text,
  p_domain text,
  p_capability text,
  p_credential_ref text,
  p_resource_id text,
  p_now timestamptz
)
returns public.jhadina_credential_lease
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.jhadina_credential_lease;
begin
  if auth.uid() is null or auth.uid()::text <> p_actor_id then
    raise exception 'credential lease actor must match the authenticated caller';
  end if;

  delete from public.jhadina_credential_lease
   where lease_id = p_lease_id
     and actor_id = p_actor_id
     and worker_id = p_worker_id
     and domain = p_domain
     and capability = p_capability
     and credential_ref = p_credential_ref
     and resource_id is not distinct from p_resource_id
     and expires_at > p_now
  returning * into v_row;

  if not found then
    return null;
  end if;
  return v_row;
end;
$$;

grant execute on function public.issue_jhadina_credential_lease(uuid, text, text, text, text, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.consume_jhadina_credential_lease(uuid, text, text, text, text, text, text, timestamptz) to authenticated;
