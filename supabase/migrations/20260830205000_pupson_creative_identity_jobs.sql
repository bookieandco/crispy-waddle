-- Durable application schema for reusable pet identities and asynchronous creative work.
-- Storage objects remain in the private pupson-assets bucket; the database stores
-- ownership, lineage, metadata, and job/output state rather than binary payloads.

create table if not exists public.pupson_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('original','foreground','mask','generated','edited','video','other')),
  storage_path text not null,
  mime_type text,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, storage_path)
);

create table if not exists public.pupson_pet_identities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  primary_asset_id uuid references public.pupson_media_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pupson_pet_identity_assets (
  pet_identity_id uuid not null references public.pupson_pet_identities(id) on delete cascade,
  asset_id uuid not null references public.pupson_media_assets(id) on delete cascade,
  role text not null check (role in ('reference','foreground','mask')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (pet_identity_id, asset_id)
);

create table if not exists public.pupson_creative_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_identity_id uuid references public.pupson_pet_identities(id) on delete set null,
  operation text not null check (operation in ('background_remove','generate_image','edit_image','enhance_image','generate_video','compose_product')),
  status text not null default 'queued' check (status in ('queued','preprocessing','generating','reviewing','completed','failed','cancelled')),
  intent jsonb not null default '{}'::jsonb,
  provider text,
  provider_job_id text,
  error_message text,
  output_count integer not null default 3 check (output_count between 1 and 8),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.pupson_creative_outputs (
  id uuid primary key default gen_random_uuid(),
  creative_job_id uuid not null references public.pupson_creative_jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid references public.pupson_media_assets(id) on delete set null,
  output_index integer not null,
  status text not null default 'pending' check (status in ('pending','available','selected','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (creative_job_id, output_index)
);

create index if not exists pupson_media_assets_owner_idx
  on public.pupson_media_assets (owner_id, created_at desc);
create index if not exists pupson_pet_identities_owner_idx
  on public.pupson_pet_identities (owner_id, updated_at desc);
create index if not exists pupson_pet_identity_assets_asset_idx
  on public.pupson_pet_identity_assets (asset_id);
create index if not exists pupson_creative_jobs_owner_status_idx
  on public.pupson_creative_jobs (owner_id, status, created_at desc);
create index if not exists pupson_creative_jobs_pet_identity_idx
  on public.pupson_creative_jobs (pet_identity_id, created_at desc);
create index if not exists pupson_creative_jobs_provider_idx
  on public.pupson_creative_jobs (provider, provider_job_id)
  where provider_job_id is not null;
create index if not exists pupson_creative_outputs_job_idx
  on public.pupson_creative_outputs (creative_job_id, output_index);
