-- Money connection ownership boundary.
-- State only: authorization logic remains in Money Core/app services.
create table if not exists public.money_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  external_connection_id text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_connection_id)
);

create index if not exists idx_money_provider_connections_user_provider
  on public.money_provider_connections (user_id, provider)
  where status = 'active';

alter table public.money_provider_connections enable row level security;

-- The app uses a server-side service-role client for the ownership check.
-- Do not expose this table directly to browser clients.
create policy money_provider_connections_service_role_only
  on public.money_provider_connections
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.money_provider_connections is
  'Server-side ownership mapping between a Jhadina user and an external money-provider connection. No business authorization logic lives here.';
