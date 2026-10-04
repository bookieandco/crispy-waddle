-- SOCIAL-AYRSHARE-LIVE.1 — encrypted, owner-scoped Ayrshare profile bindings.
-- Profile-Key is a provider credential. It never belongs in browser-readable
-- jhadina_social_accounts, publication proposals, outbox rows, or observations.

create table if not exists public.jhadina_social_ayrshare_bindings (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_profile_id text not null,
  encrypted_profile_key text not null,
  platform text not null,
  display_name text not null,
  handle text,
  evidence_refs jsonb not null check (
    jsonb_typeof(evidence_refs) = 'array'
    and jsonb_array_length(evidence_refs) > 0
  ),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, provider_profile_id)
);

create index if not exists jhadina_social_ayrshare_bindings_owner_idx
  on public.jhadina_social_ayrshare_bindings(user_id, platform, observed_at desc);

alter table public.jhadina_social_ayrshare_bindings enable row level security;

revoke all on public.jhadina_social_ayrshare_bindings from public, anon, authenticated;
grant select, insert, update, delete on public.jhadina_social_ayrshare_bindings to service_role;

-- Intentionally no anon/authenticated RLS policy. Service-role/server-only
-- composition owns both encrypted credential writes and reads.
