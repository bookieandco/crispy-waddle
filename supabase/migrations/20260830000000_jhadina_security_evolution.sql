-- Jhadina Security Evolution / durable security state.
-- Internal state lives in the non-exposed private schema. Application access is
-- intentionally server-side only; no anon/authenticated grants are created.

create schema if not exists private;

create table if not exists private.jhadina_security_replay_nonces (
  nonce text primary key,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now()
);

create index if not exists jhadina_security_replay_expiry_idx
  on private.jhadina_security_replay_nonces (expires_at);

create table if not exists private.jhadina_security_observations (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  category text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  summary text not null,
  evidence_hash text not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists private.jhadina_security_change_proposals (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references private.jhadina_security_observations(id),
  mode text not null check (mode in ('tighten','quarantine','revoke','observe')),
  target text not null,
  current_version text not null,
  proposed_version text not null,
  rationale text not null,
  reversible boolean not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','DEPLOYED','ROLLED_BACK')),
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  deployed_at timestamptz,
  rolled_back_at timestamptz
);

create index if not exists jhadina_security_proposals_status_idx
  on private.jhadina_security_change_proposals (status, generated_at desc);

create table if not exists private.jhadina_security_policy_versions (
  version text primary key,
  policy_hash text not null unique,
  policy_document jsonb not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz
);

-- Atomic replay consumption. The unique primary key makes the first insert win
-- across concurrent Jhadina instances. Expired rows are intentionally retained
-- until cleanup so an old nonce cannot become reusable through a race.
create or replace function private.consume_security_nonce(
  p_nonce text,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  if p_nonce is null or length(p_nonce) < 16 then
    return false;
  end if;
  if p_expires_at <= clock_timestamp() then
    return false;
  end if;

  insert into private.jhadina_security_replay_nonces (nonce, expires_at)
  values (p_nonce, p_expires_at)
  on conflict (nonce) do nothing;

  return found;
end;
$$;

revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on all tables in schema private to service_role;
grant execute on function private.consume_security_nonce(text, timestamptz) to service_role;

-- Cleanup is intentionally a separate privileged operation. It must never run
-- as part of authorization because deleting expired rows during an auth race
-- could turn replay protection into a time-of-check/time-of-use problem.
create or replace function private.cleanup_security_nonces()
returns integer
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  removed integer;
begin
  delete from private.jhadina_security_replay_nonces
  where expires_at < clock_timestamp() - interval '1 day';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function private.cleanup_security_nonces() from public, anon, authenticated;
grant execute on function private.cleanup_security_nonces() to service_role;
