-- JLLM-18P — direct/resumable private upload sessions.
-- A signed upload token grants write access only to one random quarantine object.
-- A session is not trusted or registered as an Intelligence Asset until finalize
-- verifies object metadata, media scan verdict/hash, promotion, and perception enqueue.

create table if not exists public.jhadina_upload_sessions (
  id uuid primary key,
  actor_id text not null,
  quarantine_path text not null unique,
  filename text not null,
  declared_media_type text not null,
  modality text not null check (modality in ('image','audio','video','document','text','code')),
  expected_byte_length bigint not null check (expected_byte_length > 0),
  privacy_class text not null check (privacy_class in ('internal','sensitive','restricted')),
  intent text,
  status text not null default 'issued'
    check (status in ('issued','finalized','rejected','expired')),
  expires_at timestamptz not null,
  finalize_lease_owner text,
  finalize_lease_token text,
  finalize_lease_expires_at timestamptz,
  scan_sha256 text,
  scan_at timestamptz,
  asset_id text,
  perception_job_id text,
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (actor_id, id)
);

create index if not exists jhadina_upload_sessions_actor_created_idx
  on public.jhadina_upload_sessions (actor_id, created_at desc);

create index if not exists jhadina_upload_sessions_finalize_idx
  on public.jhadina_upload_sessions (status, expires_at, finalize_lease_expires_at);

alter table public.jhadina_upload_sessions enable row level security;
revoke all on public.jhadina_upload_sessions from public, anon, authenticated;
grant select, insert, update on public.jhadina_upload_sessions to service_role;

create or replace function public.claim_jhadina_upload_session_finalize(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_ms integer
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if nullif(trim(p_worker_id),'') is null then return null; end if;

  update public.jhadina_upload_sessions
     set status = case when expires_at <= v_now then 'expired' else status end,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and expires_at <= v_now;

  update public.jhadina_upload_sessions
     set finalize_lease_owner = p_worker_id,
         finalize_lease_token = encode(gen_random_bytes(16),'hex'),
         finalize_lease_expires_at =
           v_now + make_interval(secs => greatest(p_lease_ms,1)::double precision / 1000),
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and expires_at > v_now
     and (
       finalize_lease_expires_at is null
       or finalize_lease_expires_at <= v_now
     )
   returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.renew_jhadina_upload_session_finalize_lease(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_lease_ms integer
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_upload_sessions
     set finalize_lease_expires_at =
           v_now + make_interval(secs => greatest(p_lease_ms,1)::double precision / 1000),
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and finalize_lease_owner = p_worker_id
     and finalize_lease_token = p_lease_token
     and finalize_lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.record_jhadina_upload_session_scan(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_sha256 text,
  p_scanned_at timestamptz
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_sha256 !~ '^[a-fA-F0-9]{64}$' then
    raise exception 'UPLOAD_SESSION_SHA256_INVALID';
  end if;

  update public.jhadina_upload_sessions
     set scan_sha256 = lower(p_sha256),
         scan_at = p_scanned_at,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and finalize_lease_owner = p_worker_id
     and finalize_lease_token = p_lease_token
     and finalize_lease_expires_at > v_now
     and (scan_sha256 is null or scan_sha256 = lower(p_sha256))
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.complete_jhadina_upload_session(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_asset_id text,
  p_perception_job_id text
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_upload_sessions
     set status = 'finalized',
         asset_id = p_asset_id,
         perception_job_id = p_perception_job_id,
         last_error = null,
         finalize_lease_owner = null,
         finalize_lease_token = null,
         finalize_lease_expires_at = null,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and scan_sha256 is not null
     and finalize_lease_owner = p_worker_id
     and finalize_lease_token = p_lease_token
     and finalize_lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.reject_jhadina_upload_session(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_error text
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_upload_sessions
     set status = 'rejected',
         last_error = left(coalesce(p_error,''), 8000),
         finalize_lease_owner = null,
         finalize_lease_token = null,
         finalize_lease_expires_at = null,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and finalize_lease_owner = p_worker_id
     and finalize_lease_token = p_lease_token
     and finalize_lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.release_jhadina_upload_session_finalize(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_error text
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_upload_sessions
     set last_error = left(coalesce(p_error,''), 8000),
         finalize_lease_owner = null,
         finalize_lease_token = null,
         finalize_lease_expires_at = null,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and finalize_lease_owner = p_worker_id
     and finalize_lease_token = p_lease_token
   returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.claim_jhadina_upload_session_finalize(text,uuid,text,integer) from public,anon,authenticated;
revoke execute on function public.renew_jhadina_upload_session_finalize_lease(text,uuid,text,text,integer) from public,anon,authenticated;
revoke execute on function public.record_jhadina_upload_session_scan(text,uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke execute on function public.complete_jhadina_upload_session(text,uuid,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.reject_jhadina_upload_session(text,uuid,text,text,text) from public,anon,authenticated;
revoke execute on function public.release_jhadina_upload_session_finalize(text,uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.claim_jhadina_upload_session_finalize(text,uuid,text,integer) to service_role;
grant execute on function public.renew_jhadina_upload_session_finalize_lease(text,uuid,text,text,integer) to service_role;
grant execute on function public.record_jhadina_upload_session_scan(text,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.complete_jhadina_upload_session(text,uuid,text,text,text,text) to service_role;
grant execute on function public.reject_jhadina_upload_session(text,uuid,text,text,text) to service_role;
grant execute on function public.release_jhadina_upload_session_finalize(text,uuid,text,text,text) to service_role;
