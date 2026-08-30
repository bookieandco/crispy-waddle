create table if not exists public.jhadina_security_nonces (
  nonce text primary key,
  principal_id text not null,
  actor_id text not null,
  request_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now()
);

create index if not exists jhadina_security_nonces_expires_idx
  on public.jhadina_security_nonces (expires_at);

create table if not exists public.jhadina_security_approvals (
  approval_id uuid primary key,
  principal_id text not null,
  actor_id text not null,
  device_id text not null,
  session_id text not null,
  capability text not null,
  domain text not null,
  resource_id text,
  payload_hash text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint jhadina_security_approvals_expiry_ck check (expires_at > issued_at),
  constraint jhadina_security_approvals_consumed_ck check (consumed_at is null or consumed_at >= issued_at)
);

create index if not exists jhadina_security_approvals_lookup_idx
  on public.jhadina_security_approvals (principal_id, capability, payload_hash, expires_at);

alter table public.jhadina_security_nonces enable row level security;
alter table public.jhadina_security_approvals enable row level security;

-- No client policy is intentionally granted here. These are control-plane tables.
-- Access must occur through a server-side security service using a tightly scoped role.

create or replace function public.jhadina_consume_security_nonce(
  p_nonce text,
  p_principal_id text,
  p_actor_id text,
  p_request_id text,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_expires_at <= now() then
    return false;
  end if;

  insert into public.jhadina_security_nonces (nonce, principal_id, actor_id, request_id, expires_at)
  values (p_nonce, p_principal_id, p_actor_id, p_request_id, p_expires_at)
  on conflict (nonce) do nothing;

  return found;
end;
$$;

revoke all on function public.jhadina_consume_security_nonce(text, text, text, text, timestamptz) from public, anon, authenticated;
