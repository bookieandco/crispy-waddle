-- PupsonStuff PS-CLOSE.2 through PS-CLOSE.6 production spine.
-- All shopper access is mediated by server routes. Browser roles receive no
-- direct table/storage privileges; the service role performs scoped reads and
-- writes after validating the signed guest owner cookie or an admin session.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pupson-originals', 'pupson-originals', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('pupson-creative', 'pupson-creative', false, 26214400, array['image/png','image/jpeg','image/webp','video/mp4']),
  ('pupson-print-ready', 'pupson-print-ready', false, 52428800, array['image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.pupson_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_token_hash text not null,
  kind text not null check (kind in ('original','normalized','generated','mockup','print_ready','animation')),
  bucket_id text not null,
  object_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sha256 text not null,
  source_asset_id uuid references public.pupson_media_assets(id) on delete set null,
  provenance jsonb not null default '{}'::jsonb,
  retention_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pupson_pet_identities (
  id uuid primary key default gen_random_uuid(),
  owner_token_hash text not null,
  name text not null check (char_length(name) between 1 and 80),
  status text not null default 'draft' check (status in ('draft','ready','archived')),
  primary_asset_id uuid references public.pupson_media_assets(id) on delete set null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pupson_pet_identity_assets (
  pet_identity_id uuid not null references public.pupson_pet_identities(id) on delete cascade,
  media_asset_id uuid not null references public.pupson_media_assets(id) on delete cascade,
  role text not null default 'reference' check (role in ('primary','reference','profile','detail')),
  quality_score numeric(5,2) check (quality_score is null or quality_score between 0 and 100),
  quality_findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (pet_identity_id, media_asset_id)
);

create table if not exists public.pupson_creative_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_token_hash text not null,
  pet_identity_id uuid not null references public.pupson_pet_identities(id) on delete restrict,
  product_id text not null,
  art_style text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  provider text,
  model text,
  prompt_version text not null default 'pupson-v1',
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_token_hash, idempotency_key)
);

create table if not exists public.pupson_creative_job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.pupson_creative_jobs(id) on delete cascade,
  attempt integer not null check (attempt > 0),
  provider text not null,
  model text,
  status text not null check (status in ('running','succeeded','failed')),
  error text,
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (job_id, attempt)
);

create table if not exists public.pupson_creative_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.pupson_creative_jobs(id) on delete cascade,
  generated_asset_id uuid not null references public.pupson_media_assets(id) on delete restrict,
  print_asset_id uuid references public.pupson_media_assets(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approved_at timestamptz,
  quality_gate jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, version)
);

create table if not exists public.pupson_catalog_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  variant_id text not null,
  provider text not null check (provider in ('printful','printify')),
  provider_product_id text not null,
  provider_variant_id text not null,
  blueprint_id text,
  print_provider_id text,
  print_area text not null,
  retail_price_cents integer not null check (retail_price_cents > 0),
  base_cost_cents integer check (base_cost_cents is null or base_cost_cents >= 0),
  currency text not null default 'usd',
  active boolean not null default false,
  certification_status text not null default 'uncertified' check (certification_status in ('uncertified','sandbox_verified','sample_verified','suspended')),
  certified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (product_id, variant_id)
);

create table if not exists public.pupson_fulfillment_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.pupson_orders(id) on delete restrict,
  provider text not null check (provider in ('printful','printify')),
  provider_order_id text unique,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','submitting','submitted','in_production','shipped','fulfilled','blocked','failed','cancelled')),
  attempt_count integer not null default 0,
  last_error text,
  tracking jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pupson_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  fulfillment_order_id uuid not null references public.pupson_fulfillment_orders(id) on delete cascade,
  provider_event_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (fulfillment_order_id, provider_event_id)
);

create table if not exists public.pupson_usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_token_hash text not null,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.pupson_order_items
  add column if not exists creative_output_id uuid references public.pupson_creative_outputs(id) on delete restrict,
  add column if not exists print_asset_id uuid references public.pupson_media_assets(id) on delete restrict,
  add column if not exists catalog_snapshot jsonb not null default '{}'::jsonb;

alter table public.pupson_orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists shipping_address jsonb;

create index if not exists pupson_media_owner_idx on public.pupson_media_assets (owner_token_hash, created_at desc) where deleted_at is null;
create index if not exists pupson_pet_owner_idx on public.pupson_pet_identities (owner_token_hash, created_at desc);
create index if not exists pupson_jobs_owner_idx on public.pupson_creative_jobs (owner_token_hash, created_at desc);
create index if not exists pupson_jobs_queue_idx on public.pupson_creative_jobs (status, created_at) where status in ('queued','running');
create index if not exists pupson_outputs_job_idx on public.pupson_creative_outputs (job_id, version desc);
create index if not exists pupson_fulfillment_status_idx on public.pupson_fulfillment_orders (status, created_at);
create index if not exists pupson_usage_window_idx on public.pupson_usage_events (owner_token_hash, action, created_at desc);

create or replace function public.pupson_touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['pupson_pet_identities','pupson_creative_jobs','pupson_catalog_variants','pupson_fulfillment_orders']
  loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.pupson_touch_updated_at()', table_name, table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'pupson_media_assets','pupson_pet_identities','pupson_pet_identity_assets',
    'pupson_creative_jobs','pupson_creative_job_attempts','pupson_creative_outputs',
    'pupson_catalog_variants','pupson_fulfillment_orders','pupson_fulfillment_events','pupson_usage_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;

revoke all on function public.pupson_touch_updated_at() from public, anon, authenticated;
grant execute on function public.pupson_touch_updated_at() to service_role;

-- Storage is server-only for launch. Explicitly remove browser writes; the
-- service role bypasses RLS after application-level owner/admin checks.
drop policy if exists "pupson browser insert" on storage.objects;
drop policy if exists "pupson browser select" on storage.objects;
