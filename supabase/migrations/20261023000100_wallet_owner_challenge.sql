-- JHADINA WALLET.PROOF.26 — SOURCE ONLY. Requires separately reviewed migration.
-- Only privileged server routes may issue or consume owner-bound proof challenges.
-- A verified wallet remains read-only and never grants a trading signer lease.

create table if not exists public.money_wallet_owner_challenges (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null check (length(wallet_address) between 32 and 44),
  challenge_text text not null check (length(challenge_text) between 40 and 900),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint money_wallet_owner_challenge_window
    check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes')
);

create index if not exists money_wallet_owner_challenges_owner_recent
  on public.money_wallet_owner_challenges(owner_id, issued_at desc);

create table if not exists public.money_wallet_verified_ownership (
  owner_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null check (length(wallet_address) between 32 and 44),
  challenge_id uuid not null unique references public.money_wallet_owner_challenges(id),
  verified_at timestamptz not null default now(),
  provider text not null default 'phantom' check (provider='phantom'),
  trading_enabled boolean not null default false check (trading_enabled=false),
  can_sign boolean not null default false check (can_sign=false),
  primary key (owner_id, wallet_address)
);

alter table public.money_wallet_owner_challenges enable row level security;
alter table public.money_wallet_verified_ownership enable row level security;
-- No client RLS policies on either table: service-only mutations.
revoke all on table public.money_wallet_owner_challenges from public, anon, authenticated;
revoke all on table public.money_wallet_verified_ownership from public, anon, authenticated;
grant select, insert, update, delete on public.money_wallet_owner_challenges to service_role;
grant select, insert, update, delete on public.money_wallet_verified_ownership to service_role;

comment on table public.money_wallet_owner_challenges is
  'Owner-authenticated single-use signed message challenges, no keys, 5-minute expiry, no client access.';
comment on table public.money_wallet_verified_ownership is
  'Server-confirmed Ed25519 ownership only: immutable false signing and trading permissions.';


-- Both operations serialize on one owner/wallet key so disconnect revocation
-- also expires pending challenges. Called ONLY after the trusted Next.js
-- server verifies the actual Ed25519 signature of the stored message.
-- SECURITY INVOKER: service_role table privileges, never client privileges.
create or replace function public.jhadina_wallet_commit_owner_proof(
  p_owner_id uuid,
  p_wallet_address text,
  p_challenge_id uuid
) returns boolean
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_consumed integer;
begin
  if p_owner_id is null or p_challenge_id is null or
      p_wallet_address is null or length(p_wallet_address) not between 32 and 44 then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'jhadina:owner-wallet:' || p_owner_id::text || ':' || p_wallet_address, 0
    )
  );
  update public.money_wallet_owner_challenges
  set consumed_at = pg_catalog.now()
  where id = p_challenge_id
    and owner_id = p_owner_id
    and wallet_address = p_wallet_address
    and consumed_at is null
    and expires_at > pg_catalog.now();
  get diagnostics v_consumed = row_count;
  if v_consumed <> 1 then return false; end if;

  insert into public.money_wallet_verified_ownership(
    owner_id, wallet_address, challenge_id, verified_at, provider,
    trading_enabled, can_sign
  ) values (
    p_owner_id, p_wallet_address, p_challenge_id, pg_catalog.now(),
    'phantom', false, false
  )
  on conflict (owner_id, wallet_address) do update
    set challenge_id = excluded.challenge_id,
        verified_at = excluded.verified_at,
        trading_enabled = false, can_sign = false;
  return true;
end;
$$;

create or replace function public.jhadina_wallet_revoke_owner_proof(
  p_owner_id uuid,
  p_wallet_address text
) returns boolean
language plpgsql security invoker
set search_path = ''
as $$
begin
  if p_owner_id is null or p_wallet_address is null or
      length(p_wallet_address) not between 32 and 44 then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'jhadina:owner-wallet:' || p_owner_id::text || ':' || p_wallet_address, 0
    )
  );
  -- Previously issued unconsumed challenges cannot re-authorize after logout.
  update public.money_wallet_owner_challenges
    set consumed_at = pg_catalog.now()
    where owner_id = p_owner_id and wallet_address = p_wallet_address
      and consumed_at is null;
  delete from public.money_wallet_verified_ownership
    where owner_id = p_owner_id and wallet_address = p_wallet_address;
  return true;
end;
$$;

revoke all on function public.jhadina_wallet_commit_owner_proof(uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_wallet_revoke_owner_proof(uuid,text)
  from public, anon, authenticated;
grant execute on function public.jhadina_wallet_commit_owner_proof(uuid,text,uuid)
  to service_role;
grant execute on function public.jhadina_wallet_revoke_owner_proof(uuid,text)
  to service_role;

comment on function public.jhadina_wallet_commit_owner_proof(uuid,text,uuid)
  is 'Server-authenticated Ed25519 proof only; single-use and durable ownership commit, no signing entitlement.';
comment on function public.jhadina_wallet_revoke_owner_proof(uuid,text)
  is 'Server-only revocation of ownership and all pending proof challenges, no transaction capability.';
