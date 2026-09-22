-- Director reference-character upload, quarantine, admission and atomic Cast bootstrap.
-- Depends on director_project_authority_and_studio_qc and director_cast_voice_audio_bibles.

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
  width integer not null check(width >= 128 and width <= 16384),
  height integer not null check(height >= 128 and height <= 16384),
  sha256 text not null,
  view_hint text not null default 'unknown'
    check(view_hint in ('unknown','front','profile-left','profile-right','three-quarter-left','three-quarter-right','full-body','close-up')),
  rights_ref text not null check(length(btrim(rights_ref)) > 0),
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

create or replace function public.create_director_character_bootstrap_job(
  p_job_id text,
  p_project_id text,
  p_user_id uuid,
  p_character_id text,
  p_display_name text,
  p_archetype text,
  p_reference_asset_ids text[],
  p_requested_appearance_labels text[],
  p_build_motion_probes boolean,
  p_commercial_use boolean,
  p_bootstrap_plan jsonb,
  p_cast_record jsonb,
  p_now timestamptz
)
returns public.director_character_bootstrap_jobs
language plpgsql
security definer
set search_path=public
as $$
declare
  role_value text;
  admitted_count integer;
  result_row public.director_character_bootstrap_jobs%rowtype;
  variant jsonb;
  variant_refs text[];
  variant_hashes text[];
  pair_count integer;
  canonical_found boolean := false;
begin
  if cardinality(p_reference_asset_ids) < 1 then
    raise exception 'Director character reference required';
  end if;
  if p_cast_record is null or jsonb_typeof(p_cast_record) <> 'object' then
    raise exception 'Director cast record required';
  end if;

  select role into role_value
  from public.director_project_memberships
  where project_id=p_project_id and user_id=p_user_id;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director character bootstrap requires project edit authority';
  end if;

  select count(*) into admitted_count
  from public.director_reference_media_assets
  where project_id=p_project_id
    and id=any(p_reference_asset_ids)
    and admission_status='admitted'
    and scan_status='clean';

  if admitted_count <> cardinality(p_reference_asset_ids) then
    raise exception 'All Director character references must be admitted and clean';
  end if;

  if exists (
    select 1 from public.director_cast_characters
    where project_id=p_project_id and character_id=p_character_id
  ) then
    raise exception 'Director character already exists; use an explicit cast update path';
  end if;

  if p_cast_record->>'projectId' <> p_project_id
     or p_cast_record->>'characterId' <> p_character_id
     or p_cast_record->>'displayName' <> p_display_name
     or p_cast_record->>'archetype' <> p_archetype then
    raise exception 'Director cast record identity mismatch';
  end if;

  if jsonb_typeof(p_cast_record->'appearanceVariants') <> 'array'
     or jsonb_array_length(p_cast_record->'appearanceVariants') < 1 then
    raise exception 'Director cast appearance variant required';
  end if;

  insert into public.director_cast_characters(
    id,project_id,character_id,display_name,archetype,continuity_ref,
    behavior_dna_ref,rig_asset_id,canonical_appearance_variant_id,
    locked_traits,identity_fingerprint_refs,approved_at,approved_by,created_at
  ) values(
    p_cast_record->>'id',
    p_project_id,
    p_character_id,
    p_display_name,
    p_archetype,
    p_cast_record->>'continuityRef',
    nullif(p_cast_record->>'behaviorDnaRef',''),
    nullif(p_cast_record->>'rigAssetId',''),
    p_cast_record->>'canonicalAppearanceVariantId',
    array(select jsonb_array_elements_text(coalesce(p_cast_record->'lockedTraits','[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_cast_record->'identityFingerprintRefs','[]'::jsonb))),
    p_now,
    p_user_id,
    p_now
  );

  for variant in
    select value from jsonb_array_elements(p_cast_record->'appearanceVariants')
  loop
    if variant->>'characterId' <> p_character_id then
      raise exception 'Director appearance variant character mismatch';
    end if;

    variant_refs := array(select jsonb_array_elements_text(coalesce(variant->'referenceAssetIds','[]'::jsonb)));
    variant_hashes := array(select jsonb_array_elements_text(coalesce(variant->'referenceSha256s','[]'::jsonb)));

    if cardinality(variant_refs) < 1 or cardinality(variant_refs) <> cardinality(variant_hashes) then
      raise exception 'Director appearance variant reference/hash mismatch';
    end if;
    if not (variant_refs <@ p_reference_asset_ids) then
      raise exception 'Director appearance variant contains unapproved reference asset';
    end if;

    select count(*) into pair_count
    from unnest(variant_refs, variant_hashes) as pair(asset_id, sha256)
    join public.director_reference_media_assets asset
      on asset.id=pair.asset_id
     and asset.project_id=p_project_id
     and asset.sha256=pair.sha256
     and asset.admission_status='admitted'
     and asset.scan_status='clean';

    if pair_count <> cardinality(variant_refs) then
      raise exception 'Director appearance variant reference digest mismatch';
    end if;

    if variant->>'id' = p_cast_record->>'canonicalAppearanceVariantId' then
      canonical_found := true;
      if variant->>'kind' <> 'base' then
        raise exception 'Director canonical appearance must be base';
      end if;
    end if;

    insert into public.director_character_appearance_variants(
      id,project_id,character_id,kind,label,reference_asset_ids,reference_sha256s,
      wardrobe_notes,appearance_notes,approved_at,approved_by,created_at
    ) values(
      variant->>'id',
      p_project_id,
      p_character_id,
      variant->>'kind',
      variant->>'label',
      variant_refs,
      variant_hashes,
      array(select jsonb_array_elements_text(coalesce(variant->'wardrobeNotes','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(variant->'appearanceNotes','[]'::jsonb))),
      p_now,
      p_user_id,
      p_now
    );
  end loop;

  if not canonical_found then
    raise exception 'Director canonical appearance variant missing';
  end if;

  insert into public.director_character_bootstrap_jobs(
    id,project_id,user_id,character_id,display_name,archetype,
    reference_asset_ids,requested_appearance_labels,build_motion_probes,
    commercial_use,bootstrap_plan,status,created_at,updated_at
  ) values(
    p_job_id,p_project_id,p_user_id,p_character_id,p_display_name,p_archetype,
    p_reference_asset_ids,coalesce(p_requested_appearance_labels,'{}'),
    p_build_motion_probes,p_commercial_use,p_bootstrap_plan,'reference_locked',p_now,p_now
  )
  returning * into result_row;

  insert into public.director_character_bootstrap_events(
    job_id,event_type,status,metadata,created_at
  ) values(
    p_job_id,
    'canonical-reference-locked',
    'completed',
    jsonb_build_object(
      'characterId',p_character_id,
      'referenceAssetIds',p_reference_asset_ids,
      'continuityRef',p_cast_record->>'continuityRef',
      'canonicalAppearanceVariantId',p_cast_record->>'canonicalAppearanceVariantId'
    ),
    p_now
  );

  return result_row;
end;
$$;

revoke all on function public.create_director_character_bootstrap_job(
  text,text,uuid,text,text,text,text[],text[],boolean,boolean,jsonb,jsonb,timestamptz
) from public,anon,authenticated;
grant execute on function public.create_director_character_bootstrap_job(
  text,text,uuid,text,text,text,text[],text[],boolean,boolean,jsonb,jsonb,timestamptz
) to service_role;
