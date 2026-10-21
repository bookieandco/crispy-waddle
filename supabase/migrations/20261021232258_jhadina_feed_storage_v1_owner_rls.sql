-- Applied to Jhadina Supabase project kqbkaozfjubkjevdfvic via Supabase apply_migration.
-- Migration history version: 20261021232258. Owner-scoped read only; server writes separately gated.
-- This is the exact executable SQL used (proposal wrapper/comments omitted).
create table if not exists public.jhadina_feed_connections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check (provider in ('youtube','facebook_page','instagram_professional','tiktok_creator','reddit','bluesky','mastodon')),
 source_account text not null check (length(source_account) between 1 and 200),
 source_kind text not null check (source_kind in ('public_author','owner_granted')),
 capability text not null check (capability in ('public_read','authorized_owner_read')),
 state text not null default 'registered' check (state in ('registered','healthy','stale','reconnect','provider_error','disabled')),
 -- No OAuth tokens, cookies or unrestricted upstream payloads in this schema.
 scopes text[] not null default array[]::text[],
 last_verified_at timestamptz,
 last_sync_at timestamptz,
 retry_at timestamptz,
 next_cursor text check (length(next_cursor) <= 1024),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint jhadina_feed_connections_owner_provider_account unique (user_id,provider,source_account),
 constraint jhadina_feed_source_capability_guard check (
   (source_kind='public_author' and capability='public_read')
   or (source_kind='owner_granted' and capability='authorized_owner_read')
 )
);
create index if not exists jhadina_feed_connections_user_state_idx
 on public.jhadina_feed_connections (user_id,state);

create table if not exists public.jhadina_feed_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null,
 source_account text not null,
 external_id text not null check (length(external_id) between 1 and 255),
 title text not null check (length(title) between 1 and 300),
 summary text not null check (length(summary) between 1 and 4000),
 occurred_at timestamptz not null,
 observed_at timestamptz not null default now(),
 url text not null check (length(url) between 9 and 1024 and url ~ '^https://'),
 provenance jsonb not null default '[]'::jsonb check (jsonb_typeof(provenance)='array'),
 source_trust text not null default 'provider_verified' check (source_trust='provider_verified'),
 expires_at timestamptz not null default (now()+interval '30 days'),
 constraint jhadina_feed_items_unique_source unique (user_id,provider,external_id),
 constraint jhadina_feed_items_parent foreign key (user_id,provider,source_account)
  references public.jhadina_feed_connections (user_id,provider,source_account) on delete cascade
);
create index if not exists jhadina_feed_items_user_time_idx
 on public.jhadina_feed_items (user_id,occurred_at desc);
create index if not exists jhadina_feed_items_expiry_idx
 on public.jhadina_feed_items (expires_at);

create table if not exists public.jhadina_feed_sync_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null,
 source_account text not null,
 status text not null check (status in ('started','succeeded','partial','failed','retry')),
 items_seen integer not null default 0 check (items_seen between 0 and 500),
 items_written integer not null default 0 check (items_written between 0 and 500),
 cursor_before text check (length(cursor_before) <= 1024),
 cursor_after text check (length(cursor_after) <= 1024),
 failure_code text check (length(failure_code) <= 100),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 retry_at timestamptz,
 constraint jhadina_feed_sync_runs_parent foreign key (user_id,provider,source_account)
  references public.jhadina_feed_connections (user_id,provider,source_account) on delete cascade
);
create index if not exists jhadina_feed_sync_runs_user_started_idx
 on public.jhadina_feed_sync_runs (user_id,started_at desc);

alter table public.jhadina_feed_connections enable row level security;
alter table public.jhadina_feed_items enable row level security;
alter table public.jhadina_feed_sync_runs enable row level security;
revoke all on public.jhadina_feed_connections,public.jhadina_feed_items,public.jhadina_feed_sync_runs from public,anon,authenticated;
grant select on public.jhadina_feed_connections,public.jhadina_feed_items,public.jhadina_feed_sync_runs to authenticated;
grant select,insert,update,delete on public.jhadina_feed_connections,public.jhadina_feed_items,public.jhadina_feed_sync_runs to service_role;

create policy jhadina_feed_connections_owner_read on public.jhadina_feed_connections
 for select to authenticated using ((select auth.uid()) = user_id);
create policy jhadina_feed_items_owner_read on public.jhadina_feed_items
 for select to authenticated using ((select auth.uid()) = user_id);
create policy jhadina_feed_sync_runs_owner_read on public.jhadina_feed_sync_runs
 for select to authenticated using ((select auth.uid()) = user_id);
