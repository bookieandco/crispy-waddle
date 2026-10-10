-- MUSIC-OPERATOR.36: REVIEW-ONLY atomic approved audio commit.
-- Do not apply until SWLC is writable, RLS policy inventory reviewed, and
-- two-account denial tests pass. This RPC is NEVER exposed to normal users.
begin;

create table if not exists public.music_operator_admission_receipts (
  user_id text not null,
  asset_id text not null,
  source_id text not null,
  track_id text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  rights_evidence_ref text not null,
  reviewed_by text not null,
  approved_by text not null,
  committed_at timestamptz not null default now(),
  primary key(user_id,asset_id)
);
alter table public.music_operator_admission_receipts enable row level security;
alter table public.music_operator_admission_receipts force row level security;
revoke all on public.music_operator_admission_receipts from public, anon, authenticated;
grant select, insert on public.music_operator_admission_receipts to service_role;

create or replace function public.music_operator_admit_owned(
  _owner text, _source jsonb, _asset jsonb
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  _source_id text := _source->>'id';
  _asset_id text := _asset->>'id';
  _track_id text := _asset->>'trackId';
  _path text := _asset->'provenance'->>'storagePath';
  _sha text := _asset->'provenance'->>'contentSha256';
  _rights text := _source->'metadata'->>'rightsEvidenceRef';
  _reviewer text := _source->'metadata'->>'rightsReviewedBy';
  _operator text := _source->'metadata'->>'operatorId';
  _stored jsonb;
begin
  if current_user <> 'service_role' then
    raise exception 'music approval requires service_role';
  end if;
  if _owner !~* '^[0-9a-f-]{36}$'
    or _source_id is null or length(_source_id) > 128
    or _asset_id is null or length(_asset_id) > 128
    or _track_id is null or length(_track_id) > 256
    or (_source->>'userId') is distinct from _owner
    or (_source->>'authorized') is distinct from 'true'
    or (_source->>'kind') is distinct from 'local'
    or (_source->'metadata'->>'role') is distinct from 'verified-owned-master'
    or (_asset->>'sourceId') is distinct from _source_id
    or (_asset->>'kind') is distinct from 'file'
    or (_asset->'provenance'->>'playbackAuthorized') is distinct from 'true'
    or (_asset->'provenance'->>'storageBucket') is distinct from 'music-owned'
    or _sha !~ '^[0-9a-f]{64}$'
    or (_source->'metadata'->>'contentSha256') is distinct from _sha
    or _path is distinct from _owner || '/' || split_part(_path, '/', 2)
    or _path !~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|wav|flac|m4a|aac|ogg|opus)$'
    or coalesce(length(_rights),0) < 6 or coalesce(length(_rights),0)>512
    or coalesce(length(_reviewer),0) < 2 or coalesce(length(_operator),0) < 2
    or _reviewer = _operator or _reviewer = _owner or _operator = _owner
    or (_asset->'provenance'->>'rightsEvidenceRef') is distinct from _rights
  then raise exception 'invalid independently reviewed audio admission'; end if;

  perform 1 from public.music_tracks where user_id = _owner and id = _track_id for share;
  if not found then raise exception 'music track must exist before approval'; end if;

  -- No updating a previously admitted license or bytes. An approval is
  -- immutable; distinct licenses create distinct source/asset identities.
  insert into public.music_sources
    (user_id,id,kind,name,authorized,metadata)
  values (_owner,_source_id,'local','Verified owned recording',true,_source->'metadata')
  on conflict (user_id,id) do nothing;
  select jsonb_build_object('id',id,'kind',kind,'authorized',authorized,'metadata',metadata)
    into _stored from public.music_sources where user_id=_owner and id=_source_id;
  if _stored is distinct from jsonb_build_object('id',_source_id,'kind','local','authorized',true,'metadata',_source->'metadata') then
    raise exception 'conflicting existing source approval'; end if;

  insert into public.music_assets
    (user_id,id,track_id,source_id,kind,uri,mime_type,provenance)
  values (_owner,_asset_id,_track_id,_source_id,'file',_asset->>'uri',_asset->>'mimeType',_asset->'provenance')
  on conflict (user_id,id) do nothing;
  select jsonb_build_object('trackId',track_id,'sourceId',source_id,'kind',kind,
    'uri',uri,'mimeType',mime_type,'provenance',provenance)
    into _stored from public.music_assets where user_id=_owner and id=_asset_id;
  if _stored is distinct from jsonb_build_object('trackId',_track_id,'sourceId',_source_id,'kind','file',
    'uri',_asset->>'uri','mimeType',_asset->>'mimeType','provenance',_asset->'provenance') then
    raise exception 'conflicting existing audio asset'; end if;

  insert into public.music_operator_admission_receipts
    (user_id,asset_id,source_id,track_id,content_sha256,rights_evidence_ref,reviewed_by,approved_by)
  values (_owner,_asset_id,_source_id,_track_id,_sha,_rights,_reviewer,_operator)
  on conflict(user_id,asset_id) do nothing;
  return jsonb_build_object('admitted',true,'assetId',_asset_id,'trackId',_track_id);
end $$;

-- PostgreSQL grants function execute to PUBLIC by default; REVOKE before
-- exposing this reviewed RPC through PostgREST.
revoke all on function public.music_operator_admit_owned(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.music_operator_admit_owned(text,jsonb,jsonb) to service_role;
commit;
