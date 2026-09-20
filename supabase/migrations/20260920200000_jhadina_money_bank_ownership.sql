-- MONEY read-spine: durable per-user Plaid Item/account ownership.
-- Access tokens are deliberately NOT stored here. This table is authorization metadata only.
create table if not exists public.jhadina_money_bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'plaid'),
  provider_item_id text not null,
  credential_ref text not null,
  institution_name text,
  status text not null default 'active' check (status in ('active','revoked','disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_item_id)
);

create table if not exists public.jhadina_money_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.jhadina_money_bank_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_account_id text not null,
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_account_id)
);
create index if not exists jhadina_money_bank_connections_user_idx on public.jhadina_money_bank_connections(user_id,status);
create index if not exists jhadina_money_bank_accounts_user_idx on public.jhadina_money_bank_accounts(user_id,status);
alter table public.jhadina_money_bank_connections enable row level security;
alter table public.jhadina_money_bank_accounts enable row level security;
create policy "money bank connections are owner readable" on public.jhadina_money_bank_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy "money bank accounts are owner readable" on public.jhadina_money_bank_accounts for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.jhadina_money_bank_connections from authenticated;
revoke insert, update, delete on public.jhadina_money_bank_accounts from authenticated;

create or replace function public.jhadina_money_owned_account_ids()
returns table(provider_account_id text)
language sql security invoker set search_path=public
as $$ select a.provider_account_id from public.jhadina_money_bank_accounts a join public.jhadina_money_bank_connections c on c.id=a.connection_id and c.user_id=a.user_id where a.user_id=auth.uid() and a.status='active' and c.status='active'; $$;
