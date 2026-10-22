-- Already applied to the Jhadina Supabase project as
-- 20261022034753_jhadina_requested_social_profiles_owner_only.
-- Stores owner-supplied URLs as pending selections, NOT OAuth-connected accounts.
create table public.jhadina_feed_account_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('instagram','x','tiktok','reddit','facebook')),
  handle text not null check (length(handle) between 1 and 100),
  profile_url text not null check (length(profile_url) between 16 and 500 and profile_url like 'https://%'),
  status text not null default 'authorization_required'
    check (status = 'authorization_required'),
  requested_at timestamptz not null default now(),
  primary key (user_id, provider, handle)
);
alter table public.jhadina_feed_account_requests enable row level security;
revoke all on public.jhadina_feed_account_requests from public, anon, authenticated;
grant select on public.jhadina_feed_account_requests to authenticated;
grant select, insert, update, delete on public.jhadina_feed_account_requests to service_role;
create policy jhadina_feed_requests_owner_read on public.jhadina_feed_account_requests
 for select to authenticated using ((select auth.uid()) = user_id);
comment on table public.jhadina_feed_account_requests is
 'Owner-selected profile URLs only; neither account ownership nor OAuth nor private-feed access is established.';
