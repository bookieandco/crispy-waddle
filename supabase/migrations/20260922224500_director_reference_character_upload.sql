-- Director reference-character upload/admission and cast/voice schema reconciliation.
-- Forward-only repair: keeps historical migrations immutable.

create table if not exists public.director_reference_media (
  id text primary key,
  project_id text not null,
  character_id text not null,
  uploaded_by_user_id uuid not null references auth.users(id) on delete restrict,
  bucket_id text not null default 'director-media' check (bucket_id = 'director-media'),
  object_path text not null unique,
  original_filename text not null,
  original_mime_type text not null check (original_mime_type in ('image/jpeg','image/png','image/webp')),
  normalized_mime_type text not null default 'image/png' check (normalized_mime_type = 'image/png'),
  original_byte_size bigint not null check (original_byte_size > 0 and original_byte_size <= 10485760),
  normalized_byte_size bigint not null check (normalized_byte_size > 0 and normalized_byte_size <= 26214400),
  width integer not null check (width >= 512 and width <= 16384),
  height integer not null check (height >= 512 and height <= 16384),
  original_sha256 text not null,
  normalized_sha256 text not null,
  rights_ref text not null check (length(btrim(rights_ref)) > 0),
  consent_ref text not null check (length(btrim(consent_ref)) > 0),
  admission_status text not null check (admission_status in ('quarantined','admitted','rejected')),
  sanitization_receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  admitted_at timestamptz,
  unique(project_id, character_id, normalized_sha256),
  check (
    admission_status <> 'admitted'
    or (
      sanitization_receipt->>'status' = 'passed'
      and admitted_at is not null
    )
  )
);

create index if not exists director_reference_media_character_idx
  on public.director_reference_media(project_id, character_id, created_at);

alter table public.director_reference_media enable row level security;
revoke all on public.director_reference_media from public, anon, authenticated;
grant select, insert, update on public.director_reference_media to service_role;

drop policy if exists director_reference_media_service_role_only on public.director_reference_media;
create policy director_reference_media_service_role_only
  on public.director_reference_media as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.assert_director_reference_media_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  role_value text;
begin
  select role into role_value
  from public.director_project_memberships
  where project_id=new.project_id and user_id=new.uploaded_by_user_id;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director reference media requires project edit authority';
  end if;

  if tg_op='UPDATE' then
    if old.project_id<>new.project_id
      or old.character_id<>new.character_id
      or old.uploaded_by_user_id<>new.uploaded_by_user_id
      or old.object_path<>new.object_path
      or old.original_sha256<>new.original_sha256
      or old.normalized_sha256<>new.normalized_sha256
    then
      raise exception 'Director reference media identity/provenance is immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists director_reference_media_authority_guard on public.director_reference_media;
create trigger director_reference_media_authority_guard
before insert or update on public.director_reference_media
for each row execute function public.assert_director_reference_media_authority();

-- Keep the JSON aggregate used by Director runtime separate from the normalized
-- voice table introduced by the movie-scale schema.
create table if not exists public.director_voice_identity_records (
  id text primary key,
  project_id text not null,
  character_id text not null,
  voice_identity jsonb not null,
  approved_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id, character_id)
    references public.director_cast_records(project_id, character_id)
    on delete cascade,
  unique(project_id, character_id)
);

create index if not exists director_voice_identity_records_character_idx
  on public.director_voice_identity_records(project_id, character_id);

alter table public.director_voice_identity_records enable row level security;
revoke all on public.director_voice_identity_records from public, anon, authenticated;
grant select, insert, update, delete on public.director_voice_identity_records to service_role;

drop policy if exists director_voice_identity_records_service_role_only on public.director_voice_identity_records;
create policy director_voice_identity_records_service_role_only
  on public.director_voice_identity_records as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.assert_director_voice_identity_record_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  role_value text;
begin
  select role into role_value
  from public.director_project_memberships
  where project_id=new.project_id and user_id=new.approved_by_user_id;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director voice identity record requires project edit authority';
  end if;

  if tg_op='UPDATE' and (
    old.project_id<>new.project_id
    or old.character_id<>new.character_id
    or old.approved_by_user_id<>new.approved_by_user_id
  ) then
    raise exception 'Director voice identity record authority identity is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists director_voice_identity_record_authority_guard on public.director_voice_identity_records;
create trigger director_voice_identity_record_authority_guard
before insert or update on public.director_voice_identity_records
for each row execute function public.assert_director_voice_identity_record_authority();

-- The normalized director_voice_identities table uses approved_by, not the
-- JSON aggregate's approved_by_user_id. Replace the historical shared trigger.
drop trigger if exists director_voice_identities_authority_guard on public.director_voice_identities;

create or replace function public.assert_director_normalized_voice_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  role_value text;
begin
  select role into role_value
  from public.director_project_memberships
  where project_id=new.project_id and user_id=new.approved_by;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director normalized voice mutation requires project edit authority';
  end if;

  if tg_op='UPDATE' and (
    old.project_id<>new.project_id
    or old.character_id<>new.character_id
    or old.approved_by<>new.approved_by
  ) then
    raise exception 'Director normalized voice authority identity is immutable';
  end if;

  return new;
end;
$$;

create trigger director_voice_identities_authority_guard
before insert or update on public.director_voice_identities
for each row execute function public.assert_director_normalized_voice_authority();

-- Character references are sanitized and stored privately alongside Director media.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'director-media','director-media',false,536870912,
  array[
    'image/jpeg','image/png','image/webp',
    'video/mp4','video/webm',
    'audio/wav','audio/mpeg',
    'application/json','text/vtt'
  ]
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;
