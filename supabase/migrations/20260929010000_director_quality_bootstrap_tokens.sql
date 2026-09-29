-- Single-use service-role bootstrap tokens for owner-approved production-quality fixtures.
create table if not exists public.director_quality_bootstrap_tokens (
  token_hash text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.director_quality_bootstrap_tokens enable row level security;
revoke all on public.director_quality_bootstrap_tokens from public,anon,authenticated;
grant select,insert,update,delete on public.director_quality_bootstrap_tokens to service_role;

drop policy if exists director_quality_bootstrap_tokens_service_role_only
  on public.director_quality_bootstrap_tokens;
create policy director_quality_bootstrap_tokens_service_role_only
  on public.director_quality_bootstrap_tokens
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_quality_bootstrap_tokens is
'Hashed, short-lived, single-use tokens for owner-approved Director production-quality fixture bootstrap.';
