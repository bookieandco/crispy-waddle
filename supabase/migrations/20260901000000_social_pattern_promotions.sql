-- Durable Growth Core storage for validated social-pattern promotions.
-- Pattern provenance is immutable application data: source identity is preserved
-- separately from the target account so tactics can be transferred without
-- silently transferring voice or identity.
--
-- Current Jhadina web requests do not yet have a real Supabase Auth identity;
-- follow the existing Memory Core access model and keep this table service-role
-- only until Identity/Ask Jhadina authentication is real. Do not weaken this to
-- anon/authenticated access merely to make the first adapter convenient.

create table if not exists public.growth_social_pattern_promotions (
  id text primary key,
  hypothesis_id text not null,
  source_pattern_id text not null,
  source_account_id text not null,
  target_account_id text not null,
  target_audience_id text not null,
  target_voice_id text not null,
  strategy text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  status text not null check (status = 'promoted'),
  source text not null check (source = 'validated_experiment'),
  experiment_id text not null,
  promoted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_social_pattern_promotions_target_idx
  on public.growth_social_pattern_promotions (target_account_id, promoted_at desc);

create index if not exists growth_social_pattern_promotions_source_idx
  on public.growth_social_pattern_promotions (source_account_id, promoted_at desc);

create unique index if not exists growth_social_pattern_promotions_experiment_idx
  on public.growth_social_pattern_promotions (experiment_id);

alter table public.growth_social_pattern_promotions enable row level security;

create policy growth_social_pattern_promotions_service_role_only
  on public.growth_social_pattern_promotions as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.growth_social_pattern_promotions from anon, authenticated;
