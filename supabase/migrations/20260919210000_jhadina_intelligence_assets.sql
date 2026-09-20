-- JLLM-18L — durable universal-intake assets + private upload bucket.
-- Upload bytes remain private. Files are not admitted to the trusted asset graph
-- until server-side MIME/type validation, hashing, and MediaSecurityScanner pass.

insert into storage.buckets (id, name, public, file_size_limit)
values ('jhadina-intake-private', 'jhadina-intake-private', false, 536870912)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create table if not exists public.jhadina_intelligence_assets (
  id text primary key,
  actor_id text not null,
  modality text not null check (modality in ('image','audio','video','document','text','code')),
  media_type text not null,
  asset_ref text not null,
  filename text,
  privacy_class text not null check (privacy_class in ('public','internal','sensitive','restricted')),
  content_sha256 text,
  byte_length bigint,
  status text not null check (status = 'registered'),
  created_at timestamptz not null
);

create index if not exists jhadina_intelligence_assets_actor_created_idx
  on public.jhadina_intelligence_assets (actor_id, created_at desc);

create unique index if not exists jhadina_intelligence_assets_actor_ref_idx
  on public.jhadina_intelligence_assets (actor_id, asset_ref);

create table if not exists public.jhadina_intelligence_asset_provenance (
  id bigint generated always as identity primary key,
  asset_id text not null references public.jhadina_intelligence_assets(id) on delete cascade,
  actor_id text not null,
  type text not null check (type = 'registered'),
  occurred_at timestamptz not null,
  content_sha256 text
);

create index if not exists jhadina_intelligence_asset_provenance_asset_idx
  on public.jhadina_intelligence_asset_provenance (asset_id, occurred_at);

create unique index if not exists jhadina_intelligence_asset_provenance_registration_idx
  on public.jhadina_intelligence_asset_provenance (asset_id, type);

alter table public.jhadina_intelligence_assets enable row level security;
alter table public.jhadina_intelligence_asset_provenance enable row level security;

create policy jhadina_intelligence_assets_service_role_only
  on public.jhadina_intelligence_assets as restrictive for all
  to service_role using (true) with check (true);

create policy jhadina_intelligence_asset_provenance_service_role_only
  on public.jhadina_intelligence_asset_provenance as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_intelligence_assets from anon, authenticated;
revoke all on public.jhadina_intelligence_asset_provenance from anon, authenticated;

-- No authenticated/anon storage.objects policy is intentionally created for
-- jhadina-intake-private. Access is server-side/service-role only.
