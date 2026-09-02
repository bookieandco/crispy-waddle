-- Jhadina Security: durable replay protection.
-- A nonce may be consumed at most once across all app instances/workers.
-- Expired rows are retained until cleanup; retention does not weaken the
-- uniqueness guarantee for an unexpired or replayed nonce.

create table if not exists public.jhadina_security_replay_nonces (
  nonce text primary key,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now(),
  constraint jhadina_security_replay_nonces_nonce_nonempty check (length(nonce) between 16 and 256),
  constraint jhadina_security_replay_nonces_expiry_valid check (expires_at > consumed_at)
);

create index if not exists jhadina_security_replay_nonces_expires_at_idx
  on public.jhadina_security_replay_nonces (expires_at);

alter table public.jhadina_security_replay_nonces enable row level security;

-- No client/session should read or mutate replay state directly. Application
-- code reaches it only through the narrowly scoped database function below.
revoke all on table public.jhadina_security_replay_nonces from anon, authenticated;

create or replace function public.consume_jhadina_security_nonce(
  p_nonce text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_inserted integer;
begin
  if p_nonce is null or length(p_nonce) < 16 or length(p_nonce) > 256 then
    return false;
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    return false;
  end if;

  insert into public.jhadina_security_replay_nonces (nonce, expires_at)
  values (p_nonce, p_expires_at)
  on conflict (nonce) do nothing;

  get diagnostics rows_inserted = row_count;
  return rows_inserted = 1;
end;
$$;

revoke all on function public.consume_jhadina_security_nonce(text, timestamptz) from public, anon, authenticated;
-- Supabase's server-only service_role is the intended caller. Keep this grant
-- out of browser-facing roles; never expose the service-role key to clients.
grant execute on function public.consume_jhadina_security_nonce(text, timestamptz) to service_role;

comment on function public.consume_jhadina_security_nonce(text, timestamptz)
  is 'Atomic one-time nonce consumption for Jhadina security boundaries; server-only execution.';

-- Operational cleanup can run from the trusted server/maintenance job.
-- Deleting expired rows is safe because requests must be unexpired before
-- consumption; retain them long enough for incident investigation.
create or replace function public.prune_jhadina_security_replay_nonces(
  p_before timestamptz default now() - interval '24 hours'
)
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.jhadina_security_replay_nonces
    where expires_at < p_before
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.prune_jhadina_security_replay_nonces(timestamptz) from public, anon, authenticated;
grant execute on function public.prune_jhadina_security_replay_nonces(timestamptz) to service_role;
