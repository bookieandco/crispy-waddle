-- Durable credential leases. Secret material is never stored here; only the
-- credential reference and narrowly scoped lease metadata are persisted.
create table if not exists public.jhadina_credential_leases (
  lease_id text primary key,
  actor_id text not null,
  worker_id text,
  capability text not null,
  provider text not null,
  credential_ref text not null,
  purpose text not null,
  resource_id text,
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses > 0 and max_uses <= 100),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

alter table public.jhadina_credential_leases enable row level security;
revoke all on table public.jhadina_credential_leases from anon, authenticated;

create or replace function public.create_jhadina_credential_lease(
  p_lease_id text,
  p_actor_id text,
  p_worker_id text,
  p_capability text,
  p_provider text,
  p_credential_ref text,
  p_purpose text,
  p_resource_id text,
  p_expires_at timestamptz,
  p_max_uses integer
) returns void
language plpgsql
security invoker
as $$
begin
  insert into public.jhadina_credential_leases (
    lease_id, actor_id, worker_id, capability, provider, credential_ref,
    purpose, resource_id, expires_at, max_uses
  ) values (
    p_lease_id, p_actor_id, p_worker_id, p_capability, p_provider, p_credential_ref,
    p_purpose, p_resource_id, p_expires_at, p_max_uses
  );
end;
$$;

create or replace function public.consume_jhadina_credential_lease(
  p_lease_id text,
  p_actor_id text,
  p_worker_id text,
  p_capability text,
  p_provider text,
  p_credential_ref text,
  p_purpose text,
  p_resource_id text,
  p_now timestamptz
) returns boolean
language plpgsql
security invoker
as $$
declare
  updated_count integer;
begin
  update public.jhadina_credential_leases
     set uses = uses + 1
   where lease_id = p_lease_id
     and actor_id = p_actor_id
     and worker_id is not distinct from p_worker_id
     and capability = p_capability
     and provider = p_provider
     and credential_ref = p_credential_ref
     and purpose = p_purpose
     and resource_id is not distinct from p_resource_id
     and expires_at > p_now
     and uses < max_uses;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

-- These are server-side RPCs only. Do not expose them to browser roles.
revoke all on function public.create_jhadina_credential_lease(text,text,text,text,text,text,text,text,timestamptz,integer) from public, anon, authenticated;
revoke all on function public.consume_jhadina_credential_lease(text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
