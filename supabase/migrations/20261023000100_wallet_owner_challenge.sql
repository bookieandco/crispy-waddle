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
