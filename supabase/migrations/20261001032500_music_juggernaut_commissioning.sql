-- MUSIC-COMMISSION.1 -> MUSIC-COMMISSION.FINAL durable commissioning substrate.
-- Owner-scoped, RLS-protected, RPC-only writes. No public publishing/spend authority is added.

create table if not exists public.jhadina_music_artist_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  artist_key text not null,
  canonical_name text not null,
  owner_identity text not null,
  canonical_hub text not null,
  aliases jsonb not null default '[]'::jsonb check (jsonb_typeof(aliases)='array'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  status text not null default 'canonical' check (status in ('canonical','discovered','review_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,artist_key)
);

create table if not exists public.jhadina_music_platform_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  platform text not null,
  link_kind text not null check (link_kind in ('artist','catalog','social','commerce','website')),
  profile_url text not null,
  handle text,
  verification_state text not null default 'discovered' check (verification_state in ('declared','discovered','verified','rejected')),
  confidence numeric not null default 0.5 check (confidence>=0 and confidence<=1),
  provenance_source text not null,
  observed_at timestamptz not null default now(),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,profile_url)
);

create table if not exists public.jhadina_music_catalog_releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  release_key text not null,
  title text not null,
  release_type text not null check (release_type in ('single','ep','album')),
  release_date date not null,
  track_count integer not null check (track_count>=1),
  source_platform text not null,
  source_url text not null,
  verification_state text not null default 'discovered' check (verification_state in ('discovered','verified','rejected')),
  track_titles jsonb not null default '[]'::jsonb check (jsonb_typeof(track_titles)='array'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,release_key)
);

create table if not exists public.jhadina_music_commission_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  stage text not null check (stage in (
    'MUSIC-COMMISSION.1','MUSIC-COMMISSION.2','MUSIC-COMMISSION.3','MUSIC-COMMISSION.4',
    'MUSIC-COMMISSION.5','MUSIC-COMMISSION.6','MUSIC-COMMISSION.7','MUSIC-COMMISSION.8',
    'MUSIC-COMMISSION.9','MUSIC-COMMISSION.FINAL'
  )),
  status text not null check (status in ('complete','data_required','blocked','failed')),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,stage)
);

create index if not exists jhadina_music_artist_profiles_project_idx
  on public.jhadina_music_artist_profiles(user_id,project_id,artist_key);
create index if not exists jhadina_music_platform_accounts_project_idx
  on public.jhadina_music_platform_accounts(user_id,project_id,platform,verification_state);
create index if not exists jhadina_music_catalog_releases_project_idx
  on public.jhadina_music_catalog_releases(user_id,project_id,release_date desc);
create index if not exists jhadina_music_commission_receipts_project_idx
  on public.jhadina_music_commission_receipts(user_id,project_id,stage,status);

do $$
declare t text;
begin
  foreach t in array array[
    'jhadina_music_artist_profiles',
    'jhadina_music_platform_accounts',
    'jhadina_music_catalog_releases',
    'jhadina_music_commission_receipts'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      'music_commission_owner_read_'||t,t
    );
  end loop;
end $$;

create or replace function music_private.upsert_artist_profile(
  p_project_id uuid,p_artist_key text,p_canonical_name text,p_owner_identity text,p_canonical_hub text,
  p_aliases jsonb,p_evidence_refs jsonb,p_status text
) returns public.jhadina_music_artist_profiles
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_artist_profiles;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  insert into public.jhadina_music_artist_profiles(
    user_id,project_id,artist_key,canonical_name,owner_identity,canonical_hub,aliases,evidence_refs,status
  ) values (
    v_user,p_project_id,trim(p_artist_key),trim(p_canonical_name),trim(p_owner_identity),trim(p_canonical_hub),
    coalesce(p_aliases,'[]'::jsonb),coalesce(p_evidence_refs,'[]'::jsonb),p_status
  )
  on conflict(user_id,project_id,artist_key) do update set
    canonical_name=excluded.canonical_name,
    owner_identity=excluded.owner_identity,
    canonical_hub=excluded.canonical_hub,
    aliases=excluded.aliases,
    evidence_refs=excluded.evidence_refs,
    status=excluded.status,
    updated_at=now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.jhadina_music_upsert_artist_profile(
  p_project_id uuid,p_artist_key text,p_canonical_name text,p_owner_identity text,p_canonical_hub text,
  p_aliases jsonb,p_evidence_refs jsonb,p_status text
) returns public.jhadina_music_artist_profiles
language sql security invoker set search_path='' as $$
  select * from music_private.upsert_artist_profile(
    p_project_id,p_artist_key,p_canonical_name,p_owner_identity,p_canonical_hub,p_aliases,p_evidence_refs,p_status
  )
$$;

create or replace function music_private.upsert_platform_account(
  p_project_id uuid,p_platform text,p_link_kind text,p_profile_url text,p_handle text,
  p_verification_state text,p_confidence numeric,p_provenance_source text,p_observed_at timestamptz,
  p_evidence_refs jsonb,p_metadata jsonb
) returns public.jhadina_music_platform_accounts
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_platform_accounts;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  insert into public.jhadina_music_platform_accounts(
    user_id,project_id,platform,link_kind,profile_url,handle,verification_state,confidence,
    provenance_source,observed_at,evidence_refs,metadata
  ) values (
    v_user,p_project_id,trim(p_platform),p_link_kind,trim(p_profile_url),nullif(trim(coalesce(p_handle,'')),''),
    p_verification_state,p_confidence,trim(p_provenance_source),p_observed_at,
    coalesce(p_evidence_refs,'[]'::jsonb),coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(user_id,project_id,profile_url) do update set
    platform=excluded.platform,
    link_kind=excluded.link_kind,
    handle=excluded.handle,
    verification_state=excluded.verification_state,
    confidence=excluded.confidence,
    provenance_source=excluded.provenance_source,
    observed_at=excluded.observed_at,
    evidence_refs=excluded.evidence_refs,
    metadata=excluded.metadata,
    updated_at=now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.jhadina_music_upsert_platform_account(
  p_project_id uuid,p_platform text,p_link_kind text,p_profile_url text,p_handle text,
  p_verification_state text,p_confidence numeric,p_provenance_source text,p_observed_at timestamptz,
  p_evidence_refs jsonb,p_metadata jsonb
) returns public.jhadina_music_platform_accounts
language sql security invoker set search_path='' as $$
  select * from music_private.upsert_platform_account(
    p_project_id,p_platform,p_link_kind,p_profile_url,p_handle,p_verification_state,p_confidence,
    p_provenance_source,p_observed_at,p_evidence_refs,p_metadata
  )
$$;

create or replace function music_private.upsert_catalog_release(
  p_project_id uuid,p_release_key text,p_title text,p_release_type text,p_release_date date,p_track_count integer,
  p_source_platform text,p_source_url text,p_verification_state text,p_track_titles jsonb,p_evidence_refs jsonb,p_metadata jsonb
) returns public.jhadina_music_catalog_releases
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_catalog_releases;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  insert into public.jhadina_music_catalog_releases(
    user_id,project_id,release_key,title,release_type,release_date,track_count,source_platform,source_url,
    verification_state,track_titles,evidence_refs,metadata
  ) values (
    v_user,p_project_id,trim(p_release_key),trim(p_title),p_release_type,p_release_date,p_track_count,
    trim(p_source_platform),trim(p_source_url),p_verification_state,coalesce(p_track_titles,'[]'::jsonb),
    coalesce(p_evidence_refs,'[]'::jsonb),coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(user_id,project_id,release_key) do update set
    title=excluded.title,
    release_type=excluded.release_type,
    release_date=excluded.release_date,
    track_count=excluded.track_count,
    source_platform=excluded.source_platform,
    source_url=excluded.source_url,
    verification_state=excluded.verification_state,
    track_titles=excluded.track_titles,
    evidence_refs=excluded.evidence_refs,
    metadata=excluded.metadata,
    updated_at=now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.jhadina_music_upsert_catalog_release(
  p_project_id uuid,p_release_key text,p_title text,p_release_type text,p_release_date date,p_track_count integer,
  p_source_platform text,p_source_url text,p_verification_state text,p_track_titles jsonb,p_evidence_refs jsonb,p_metadata jsonb
) returns public.jhadina_music_catalog_releases
language sql security invoker set search_path='' as $$
  select * from music_private.upsert_catalog_release(
    p_project_id,p_release_key,p_title,p_release_type,p_release_date,p_track_count,p_source_platform,p_source_url,
    p_verification_state,p_track_titles,p_evidence_refs,p_metadata
  )
$$;

create or replace function music_private.upsert_commission_receipt(
  p_project_id uuid,p_stage text,p_status text,p_evidence_refs jsonb,p_details jsonb
) returns public.jhadina_music_commission_receipts
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_commission_receipts;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  insert into public.jhadina_music_commission_receipts(user_id,project_id,stage,status,evidence_refs,details)
  values(v_user,p_project_id,p_stage,p_status,coalesce(p_evidence_refs,'[]'::jsonb),coalesce(p_details,'{}'::jsonb))
  on conflict(user_id,project_id,stage) do update set
    status=excluded.status,
    evidence_refs=excluded.evidence_refs,
    details=excluded.details,
    updated_at=now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.jhadina_music_upsert_commission_receipt(
  p_project_id uuid,p_stage text,p_status text,p_evidence_refs jsonb,p_details jsonb
) returns public.jhadina_music_commission_receipts
language sql security invoker set search_path='' as $$
  select * from music_private.upsert_commission_receipt(p_project_id,p_stage,p_status,p_evidence_refs,p_details)
$$;

revoke execute on function music_private.upsert_artist_profile(uuid,text,text,text,text,jsonb,jsonb,text) from public,anon;
revoke execute on function music_private.upsert_platform_account(uuid,text,text,text,text,text,numeric,text,timestamptz,jsonb,jsonb) from public,anon;
revoke execute on function music_private.upsert_catalog_release(uuid,text,text,text,date,integer,text,text,text,jsonb,jsonb,jsonb) from public,anon;
revoke execute on function music_private.upsert_commission_receipt(uuid,text,text,jsonb,jsonb) from public,anon;

grant execute on function music_private.upsert_artist_profile(uuid,text,text,text,text,jsonb,jsonb,text) to authenticated;
grant execute on function music_private.upsert_platform_account(uuid,text,text,text,text,text,numeric,text,timestamptz,jsonb,jsonb) to authenticated;
grant execute on function music_private.upsert_catalog_release(uuid,text,text,text,date,integer,text,text,text,jsonb,jsonb,jsonb) to authenticated;
grant execute on function music_private.upsert_commission_receipt(uuid,text,text,jsonb,jsonb) to authenticated;

revoke execute on function public.jhadina_music_upsert_artist_profile(uuid,text,text,text,text,jsonb,jsonb,text) from public,anon;
revoke execute on function public.jhadina_music_upsert_platform_account(uuid,text,text,text,text,text,numeric,text,timestamptz,jsonb,jsonb) from public,anon;
revoke execute on function public.jhadina_music_upsert_catalog_release(uuid,text,text,text,date,integer,text,text,text,jsonb,jsonb,jsonb) from public,anon;
revoke execute on function public.jhadina_music_upsert_commission_receipt(uuid,text,text,jsonb,jsonb) from public,anon;

grant execute on function public.jhadina_music_upsert_artist_profile(uuid,text,text,text,text,jsonb,jsonb,text) to authenticated;
grant execute on function public.jhadina_music_upsert_platform_account(uuid,text,text,text,text,text,numeric,text,timestamptz,jsonb,jsonb) to authenticated;
grant execute on function public.jhadina_music_upsert_catalog_release(uuid,text,text,text,date,integer,text,text,text,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.jhadina_music_upsert_commission_receipt(uuid,text,text,jsonb,jsonb) to authenticated;


-- Private royalty aggregate snapshots. These store owner-supplied/distributor evidence;
-- they are never embedded in the public source tree as user-specific values.
create table if not exists public.jhadina_music_royalty_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  statement_ref text not null,
  source text not null,
  currency text not null default 'USD',
  reported_total_minor bigint not null check (reported_total_minor>=0),
  period_start date,
  period_end date,
  observed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,statement_ref)
);

create table if not exists public.jhadina_music_royalty_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  snapshot_id uuid not null references public.jhadina_music_royalty_snapshots(id) on delete cascade,
  line_key text not null,
  line_kind text not null check (line_kind in ('service','song')),
  label text not null,
  title_group_key text,
  amount_minor bigint not null check (amount_minor>=0),
  artist_name text,
  recording_ref text,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  created_at timestamptz not null default now(),
  unique(user_id,snapshot_id,line_key)
);

create index if not exists jhadina_music_royalty_snapshots_project_idx
  on public.jhadina_music_royalty_snapshots(user_id,project_id,observed_at desc);
create index if not exists jhadina_music_royalty_lines_snapshot_idx
  on public.jhadina_music_royalty_lines(user_id,project_id,snapshot_id,line_kind);
create index if not exists jhadina_music_royalty_lines_title_idx
  on public.jhadina_music_royalty_lines(user_id,project_id,title_group_key)
  where title_group_key is not null;

do $$
declare t text;
begin
  foreach t in array array[
    'jhadina_music_royalty_snapshots',
    'jhadina_music_royalty_lines'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      'music_royalty_owner_read_'||t,t
    );
  end loop;
end $$;

create or replace function music_private.upsert_royalty_snapshot(
  p_project_id uuid,p_statement_ref text,p_source text,p_currency text,p_reported_total_minor bigint,
  p_period_start date,p_period_end date,p_observed_at timestamptz,p_metadata jsonb
) returns public.jhadina_music_royalty_snapshots
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_royalty_snapshots;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  insert into public.jhadina_music_royalty_snapshots(
    user_id,project_id,statement_ref,source,currency,reported_total_minor,period_start,period_end,observed_at,metadata
  ) values (
    v_user,p_project_id,trim(p_statement_ref),trim(p_source),upper(trim(p_currency)),p_reported_total_minor,
    p_period_start,p_period_end,p_observed_at,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(user_id,project_id,statement_ref) do update set
    source=excluded.source,
    currency=excluded.currency,
    reported_total_minor=excluded.reported_total_minor,
    period_start=excluded.period_start,
    period_end=excluded.period_end,
    observed_at=excluded.observed_at,
    metadata=excluded.metadata,
    updated_at=now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.jhadina_music_upsert_royalty_snapshot(
  p_project_id uuid,p_statement_ref text,p_source text,p_currency text,p_reported_total_minor bigint,
  p_period_start date,p_period_end date,p_observed_at timestamptz,p_metadata jsonb
) returns public.jhadina_music_royalty_snapshots
language sql security invoker set search_path='' as $$
  select * from music_private.upsert_royalty_snapshot(
    p_project_id,p_statement_ref,p_source,p_currency,p_reported_total_minor,p_period_start,p_period_end,p_observed_at,p_metadata
  )
$$;

create or replace function music_private.upsert_royalty_line(
  p_project_id uuid,p_snapshot_id uuid,p_line_key text,p_line_kind text,p_label text,p_title_group_key text,
  p_amount_minor bigint,p_artist_name text,p_recording_ref text,p_evidence_refs jsonb
) returns public.jhadina_music_royalty_lines
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_royalty_lines;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(
    select 1 from public.jhadina_music_royalty_snapshots
    where id=p_snapshot_id and project_id=p_project_id and user_id=v_user
  ) then raise exception 'royalty snapshot not found'; end if;
  insert into public.jhadina_music_royalty_lines(
    user_id,project_id,snapshot_id,line_key,line_kind,label,title_group_key,amount_minor,artist_name,recording_ref,evidence_refs
  ) values (
    v_user,p_project_id,p_snapshot_id,trim(p_line_key),p_line_kind,trim(p_label),nullif(trim(coalesce(p_title_group_key,'')),''),
    p_amount_minor,nullif(trim(coalesce(p_artist_name,'')),''),nullif(trim(coalesce(p_recording_ref,'')),''),
    coalesce(p_evidence_refs,'[]'::jsonb)
  )
  on conflict(user_id,snapshot_id,line_key) do update set
    line_kind=excluded.line_kind,
    label=excluded.label,
    title_group_key=excluded.title_group_key,
    amount_minor=excluded.amount_minor,
    artist_name=excluded.artist_name,
    recording_ref=excluded.recording_ref,
    evidence_refs=excluded.evidence_refs
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.jhadina_music_upsert_royalty_line(
  p_project_id uuid,p_snapshot_id uuid,p_line_key text,p_line_kind text,p_label text,p_title_group_key text,
  p_amount_minor bigint,p_artist_name text,p_recording_ref text,p_evidence_refs jsonb
) returns public.jhadina_music_royalty_lines
language sql security invoker set search_path='' as $$
  select * from music_private.upsert_royalty_line(
    p_project_id,p_snapshot_id,p_line_key,p_line_kind,p_label,p_title_group_key,p_amount_minor,p_artist_name,p_recording_ref,p_evidence_refs
  )
$$;

revoke execute on function music_private.upsert_royalty_snapshot(uuid,text,text,text,bigint,date,date,timestamptz,jsonb) from public,anon;
revoke execute on function music_private.upsert_royalty_line(uuid,uuid,text,text,text,text,bigint,text,text,jsonb) from public,anon;
grant execute on function music_private.upsert_royalty_snapshot(uuid,text,text,text,bigint,date,date,timestamptz,jsonb) to authenticated;
grant execute on function music_private.upsert_royalty_line(uuid,uuid,text,text,text,text,bigint,text,text,jsonb) to authenticated;

revoke execute on function public.jhadina_music_upsert_royalty_snapshot(uuid,text,text,text,bigint,date,date,timestamptz,jsonb) from public,anon;
revoke execute on function public.jhadina_music_upsert_royalty_line(uuid,uuid,text,text,text,text,bigint,text,text,jsonb) from public,anon;
grant execute on function public.jhadina_music_upsert_royalty_snapshot(uuid,text,text,text,bigint,date,date,timestamptz,jsonb) to authenticated;
grant execute on function public.jhadina_music_upsert_royalty_line(uuid,uuid,text,text,text,text,bigint,text,text,jsonb) to authenticated;


-- Music -> Director lineage. This table links Music commissioning decisions to
-- governed Director jobs without granting publish/spend authority.
create table if not exists public.jhadina_music_visual_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  song_id uuid not null references public.jhadina_music_song_campaigns(id) on delete cascade,
  experiment_id uuid references public.jhadina_music_experiments(id) on delete set null,
  plan_id text not null,
  segment_id text not null,
  deliverable text not null check (deliverable in ('lyric_video','teaser_pack','music_video','visualizer')),
  director_project_id text not null,
  director_job_id text,
  parent_director_job_id text,
  source_audio_asset_id text not null,
  vocal_stem_asset_id text,
  status text not null check (status in ('planned','data_required','blocked','submitted','generating','preview_ready','complete','failed','cancelled')),
  style_reference_asset_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(style_reference_asset_ids)='array'),
  artist_reference_asset_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(artist_reference_asset_ids)='array'),
  output_asset_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(output_asset_ids)='array'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,plan_id,segment_id)
);

create index if not exists jhadina_music_visual_jobs_project_idx
  on public.jhadina_music_visual_jobs(user_id,project_id,status,updated_at desc);
create index if not exists jhadina_music_visual_jobs_song_idx
  on public.jhadina_music_visual_jobs(user_id,project_id,song_id,deliverable);

alter table public.jhadina_music_visual_jobs enable row level security;
revoke all on public.jhadina_music_visual_jobs from anon, authenticated;
grant select on public.jhadina_music_visual_jobs to authenticated;
create policy music_visual_jobs_owner_read
  on public.jhadina_music_visual_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function music_private.upsert_visual_job(
  p_project_id uuid,p_song_id uuid,p_experiment_id uuid,p_plan_id text,p_segment_id text,p_deliverable text,
  p_director_project_id text,p_director_job_id text,p_parent_director_job_id text,p_source_audio_asset_id text,
  p_vocal_stem_asset_id text,p_status text,p_style_reference_asset_ids jsonb,p_artist_reference_asset_ids jsonb,
  p_output_asset_ids jsonb,p_evidence_refs jsonb,p_metadata jsonb
) returns public.jhadina_music_visual_jobs
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_visual_jobs;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(
    select 1 from public.jhadina_music_song_campaigns
    where id=p_song_id and project_id=p_project_id and user_id=v_user
  ) then raise exception 'music song not found'; end if;
  if p_experiment_id is not null and not exists(
    select 1 from public.jhadina_music_experiments
    where id=p_experiment_id and project_id=p_project_id and user_id=v_user
  ) then raise exception 'music experiment not found'; end if;

  insert into public.jhadina_music_visual_jobs(
    user_id,project_id,song_id,experiment_id,plan_id,segment_id,deliverable,director_project_id,
    director_job_id,parent_director_job_id,source_audio_asset_id,vocal_stem_asset_id,status,
    style_reference_asset_ids,artist_reference_asset_ids,output_asset_ids,evidence_refs,metadata
  ) values (
    v_user,p_project_id,p_song_id,p_experiment_id,trim(p_plan_id),trim(p_segment_id),p_deliverable,trim(p_director_project_id),
    nullif(trim(coalesce(p_director_job_id,'')),''),nullif(trim(coalesce(p_parent_director_job_id,'')),''),
    trim(p_source_audio_asset_id),nullif(trim(coalesce(p_vocal_stem_asset_id,'')),''),p_status,
    coalesce(p_style_reference_asset_ids,'[]'::jsonb),coalesce(p_artist_reference_asset_ids,'[]'::jsonb),
    coalesce(p_output_asset_ids,'[]'::jsonb),coalesce(p_evidence_refs,'[]'::jsonb),coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(user_id,project_id,plan_id,segment_id) do update set
    experiment_id=excluded.experiment_id,
    deliverable=excluded.deliverable,
    director_project_id=excluded.director_project_id,
    director_job_id=excluded.director_job_id,
    parent_director_job_id=excluded.parent_director_job_id,
    source_audio_asset_id=excluded.source_audio_asset_id,
    vocal_stem_asset_id=excluded.vocal_stem_asset_id,
    status=excluded.status,
    style_reference_asset_ids=excluded.style_reference_asset_ids,
    artist_reference_asset_ids=excluded.artist_reference_asset_ids,
    output_asset_ids=excluded.output_asset_ids,
    evidence_refs=excluded.evidence_refs,
    metadata=excluded.metadata,
    updated_at=now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.jhadina_music_upsert_visual_job(
  p_project_id uuid,p_song_id uuid,p_experiment_id uuid,p_plan_id text,p_segment_id text,p_deliverable text,
  p_director_project_id text,p_director_job_id text,p_parent_director_job_id text,p_source_audio_asset_id text,
  p_vocal_stem_asset_id text,p_status text,p_style_reference_asset_ids jsonb,p_artist_reference_asset_ids jsonb,
  p_output_asset_ids jsonb,p_evidence_refs jsonb,p_metadata jsonb
) returns public.jhadina_music_visual_jobs
language sql security invoker set search_path='' as $$
  select * from music_private.upsert_visual_job(
    p_project_id,p_song_id,p_experiment_id,p_plan_id,p_segment_id,p_deliverable,p_director_project_id,
    p_director_job_id,p_parent_director_job_id,p_source_audio_asset_id,p_vocal_stem_asset_id,p_status,
    p_style_reference_asset_ids,p_artist_reference_asset_ids,p_output_asset_ids,p_evidence_refs,p_metadata
  )
$$;

revoke execute on function music_private.upsert_visual_job(
  uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb
) from public,anon;
grant execute on function music_private.upsert_visual_job(
  uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb
) to authenticated;
revoke execute on function public.jhadina_music_upsert_visual_job(
  uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb
) from public,anon;
grant execute on function public.jhadina_music_upsert_visual_job(
  uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb
) to authenticated;
