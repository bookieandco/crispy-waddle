-- Forward-only extension of the existing character reference-media spine.
-- Adds product references without rewriting historical Director migrations.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'director-reference-media',
  'director-reference-media',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

alter table public.director_reference_media_assets
  add column if not exists reference_kind text not null default 'character';

alter table public.director_reference_media_assets
  drop constraint if exists director_reference_media_assets_reference_kind_check;

alter table public.director_reference_media_assets
  add constraint director_reference_media_assets_reference_kind_check
  check(reference_kind in ('character','product'));

alter table public.director_reference_media_assets
  drop constraint if exists director_reference_media_assets_view_hint_check;

alter table public.director_reference_media_assets
  add constraint director_reference_media_assets_view_hint_check
  check(view_hint in (
    'unknown','front','profile-left','profile-right','three-quarter-left','three-quarter-right','full-body','close-up',
    'hero','back','left','right','top','bottom','detail','in-use'
  ));

alter table public.director_reference_media_assets
  drop constraint if exists director_reference_media_assets_project_id_sha256_key;

create unique index if not exists director_reference_media_project_kind_sha256_uidx
  on public.director_reference_media_assets(project_id,reference_kind,sha256);

create index if not exists director_reference_media_kind_project_idx
  on public.director_reference_media_assets(reference_kind,project_id,created_at desc);

comment on column public.director_reference_media_assets.reference_kind is
'Identity domain for private Director reference media. Character and product references are never interchangeable.';
