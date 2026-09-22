-- Private uploaded reference-media quarantine and character-bootstrap job spine.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'director-character-references',
  'director-character-references',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.director_reference_media_assets (
  id text primary key,
  project_id text not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  bucket_id text not null default 'director-character-references',
  object_path text not null unique,
  original_filename text not null,
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check(byte_size > 0 and byte_size <= 20971520),
  width integer not null check(width >= 128),
  height integer not null check(height >= 128),
  sha256 text not null,
  view_hint text not null default 'unknown'
    check(view_hint in ('unknown','front','profile-left','profile-right','three-quarter-left','three-quarter-right','full-body','close-up')),
  rights_ref text not null,
  consent_ref text,
  admission_status text not null default 'quarantined'
    check(admission_status in ('quarantined','admitted','rejected')),
  scan_status text not null default 'pending'
    check(scan_status in ('pending','clean','unsafe','error')),
  scan_evidence_ids text[] not null default '{}',
  rejection_reason text,
  admitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, sha256)
);

create index if not exists director_reference_assets_project_idx
  on public.director_reference_media_assets(project_id, created_at desc);
create index if not exists director_reference_assets_quarantine_idx
  on public.director_reference_media_assets(admission_status, scan_status, created_at)
  where admission_status='quarantined';

create table if not exists public.director_character_bootstrap_jobs (
  id text primary key,
  project_id text not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  character_id text not null,
  display_name text not null,
  archetype text not null check(archetype in ('human','cartoon','puppet','creature')),
  reference_asset_ids text[] not null check(cardinality(reference_asset_ids) > 0),
  requested_appearance_labels text[] not null default '{}',
  build_motion_probes boolean not null default true,
  commercial_use boolean not null default true,
  bootstrap_plan jsonb not null,
  status text not null default 'queued'
    check(status in ('queued','running','blocked','reference_locked','ready','failed','cancelled')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, character_id, id)
);

create table if not exists public.director_character_bootstrap_events (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.director_character_bootstrap_jobs(id) on delete restrict,
  event_type text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists director_character_bootstrap_queue_idx
  on public.director_character_bootstrap_jobs(status, created_at)
  where status in ('queued','running','blocked');
create index if not exists director_character_bootstrap_events_job_idx
  on public.director_character_bootstrap_events(job_id, created_at);

alter table public.director_reference_media_assets enable row level security;
alter table public.director_character_bootstrap_jobs enable row level security;
alter table public.director_character_bootstrap_events enable row level security;

revoke all on public.director_reference_media_assets from public,anon,authenticated;
revoke all on public.director_character_bootstrap_jobs from public,anon,authenticated;
revoke all on public.director_character_bootstrap_events from public,anon,authenticated;
grant select,insert,update,delete on public.director_reference_media_assets to service_role;
grant select,insert,update on public.director_character_bootstrap_jobs to service_role;
grant select,insert on public.director_character_bootstrap_events to service_role;

drop policy if exists director_reference_media_service_role_only on public.director_reference_media_assets;
create policy director_reference_media_service_role_only
  on public.director_reference_media_assets as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_character_bootstrap_service_role_only on public.director_character_bootstrap_jobs;
create policy director_character_bootstrap_service_role_only
  on public.director_character_bootstrap_jobs as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_character_bootstrap_events_service_role_only on public.director_character_bootstrap_events;
create policy director_character_bootstrap_events_service_role_only
  on public.director_character_bootstrap_events as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.assert_director_reference_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare role_value text;
begin
  select role into role_value
  from public.director_project_memberships
  where project_id=new.project_id and user_id=new.user_id;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director reference mutation requires project edit authority';
  end if;

  if tg_op='UPDATE' and (
    old.project_id<>new.project_id or
    old.user_id<>new.user_id
  ) then
    raise exception 'Director reference ownership is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists director_reference_media_authority_guard on public.director_reference_media_assets;
create trigger director_reference_media_authority_guard
before insert or update on public.director_reference_media_assets
for each row execute function public.assert_director_reference_authority();

drop trigger if exists director_character_bootstrap_authority_guard on public.director_character_bootstrap_jobs;
create trigger director_character_bootstrap_authority_guard
before insert or update on public.director_character_bootstrap_jobs
for each row execute function public.assert_director_reference_authority();

create or replace function public.reject_director_character_bootstrap_event_mutation()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  raise exception 'Director character bootstrap events are append-only';
end;
$$;

drop trigger if exists director_character_bootstrap_events_immutable on public.director_character_bootstrap_events;
create trigger director_character_bootstrap_events_immutable
before update or delete on public.director_character_bootstrap_events
for each row execute function public.reject_director_character_bootstrap_event_mutation();
