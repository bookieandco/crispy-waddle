drop function if exists public.claim_jhadina_upload_session_finalize(text,uuid,text,integer);
drop function if exists public.release_jhadina_upload_session_finalize(text,uuid,text,text,text);

-- JLLM-18R — asynchronous direct-upload finalization + quarantine cleanup.
-- Finalization request becomes a durable queue transition. Heavy scanner/hash work
-- is performed by a leased worker, not by the user's HTTP request.

alter table public.jhadina_upload_sessions
  drop constraint if exists jhadina_upload_sessions_status_check;

alter table public.jhadina_upload_sessions
  add constraint jhadina_upload_sessions_status_check
  check (status in (
    'issued',
    'finalize_queued',
    'finalizing',
    'finalize_retry',
    'finalized',
    'rejected',
    'expired'
  ));

alter table public.jhadina_upload_sessions
  add column if not exists finalize_requested_at timestamptz,
  add column if not exists finalize_available_at timestamptz not null default clock_timestamp(),
  add column if not exists finalize_attempt integer not null default 0 check (finalize_attempt >= 0),
  add column if not exists finalize_max_attempts integer not null default 4 check (finalize_max_attempts between 1 and 20),
  add column if not exists cleanup_status text not null default 'none'
    check (cleanup_status in ('none','pending','running','cleaned')),
  add column if not exists cleanup_available_at timestamptz not null default clock_timestamp(),
  add column if not exists cleanup_attempt integer not null default 0 check (cleanup_attempt >= 0),
  add column if not exists cleanup_lease_owner text,
  add column if not exists cleanup_lease_token text,
  add column if not exists cleanup_lease_expires_at timestamptz,
  add column if not exists cleanup_error text,
  add column if not exists cleaned_at timestamptz;

create index if not exists jhadina_upload_sessions_finalize_queue_idx
  on public.jhadina_upload_sessions (
    status, finalize_available_at, finalize_lease_expires_at, finalize_requested_at
  );

create index if not exists jhadina_upload_sessions_cleanup_queue_idx
  on public.jhadina_upload_sessions (
    cleanup_status, cleanup_available_at, cleanup_lease_expires_at, updated_at
  );

create or replace function public.request_jhadina_upload_session_finalize(
  p_actor_id text,
  p_session_id uuid,
  p_max_attempts integer
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception 'DIRECT_UPLOAD_FINALIZE_MAX_ATTEMPTS_INVALID';
  end if;

  update public.jhadina_upload_sessions
     set status = 'expired',
         cleanup_status = 'pending',
         cleanup_available_at = v_now,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and expires_at <= v_now;

  update public.jhadina_upload_sessions
     set status = 'finalize_queued',
         finalize_requested_at = coalesce(finalize_requested_at, v_now),
         finalize_available_at = v_now,
         finalize_max_attempts = p_max_attempts,
         last_error = null,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'issued'
     and expires_at > v_now
   returning * into v_row;

  if v_row.id is not null then return v_row; end if;

  select * into v_row
    from public.jhadina_upload_sessions
   where id = p_session_id
     and actor_id = p_actor_id;

  return v_row;
end;
$$;

create or replace function public.claim_next_jhadina_upload_session_finalize(
  p_worker_id text,
  p_lease_ms integer
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if nullif(trim(p_worker_id),'') is null then return null; end if;

  -- Exhausted crashed workers become terminal instead of remaining stuck
  -- in finalizing forever with an expired fencing lease.
  update public.jhadina_upload_sessions
     set status = 'rejected',
         last_error = coalesce(last_error, 'DIRECT_UPLOAD_FINALIZE_ATTEMPTS_EXHAUSTED'),
         cleanup_status = 'pending',
         cleanup_available_at = v_now,
         finalize_lease_owner = null,
         finalize_lease_token = null,
         finalize_lease_expires_at = null,
         updated_at = v_now
   where status = 'finalizing'
     and finalize_lease_expires_at is not null
     and finalize_lease_expires_at <= v_now
     and finalize_attempt >= finalize_max_attempts;

  -- Expire only sessions that never requested finalization.
  update public.jhadina_upload_sessions
     set status = 'expired',
         cleanup_status = 'pending',
         cleanup_available_at = v_now,
         updated_at = v_now
   where status = 'issued'
     and expires_at <= v_now;

  select id into v_id
    from public.jhadina_upload_sessions
   where (
      status in ('finalize_queued','finalize_retry')
      or (
        status = 'finalizing'
        and finalize_lease_expires_at is not null
        and finalize_lease_expires_at <= v_now
      )
   )
     and finalize_available_at <= v_now
     and finalize_attempt < finalize_max_attempts
     and finalize_requested_at is not null
     and finalize_requested_at <= expires_at
   order by finalize_available_at asc, finalize_requested_at asc
   for update skip locked
   limit 1;

  if v_id is null then return null; end if;

  update public.jhadina_upload_sessions
     set status = 'finalizing',
         finalize_attempt = finalize_attempt + 1,
         finalize_lease_owner = p_worker_id,
         finalize_lease_token = encode(gen_random_bytes(16),'hex'),
         finalize_lease_expires_at =
           v_now + make_interval(secs => greatest(p_lease_ms,1)::double precision / 1000),
         updated_at = v_now
   where id = v_id
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
     and status = 'finalizing'
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
     and status = 'finalizing'
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
         cleanup_status = 'none',
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'finalizing'
     and scan_sha256 is not null
     and finalize_lease_owner = p_worker_id
     and finalize_lease_token = p_lease_token
     and finalize_lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.retry_jhadina_upload_session_finalize(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_error text,
  p_available_at timestamptz
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_upload_sessions
     set status = case
           when finalize_attempt >= finalize_max_attempts then 'rejected'
           else 'finalize_retry'
         end,
         finalize_available_at = greatest(p_available_at, v_now),
         last_error = left(coalesce(p_error,''), 8000),
         cleanup_status = case
           when finalize_attempt >= finalize_max_attempts then 'pending'
           else cleanup_status
         end,
         cleanup_available_at = case
           when finalize_attempt >= finalize_max_attempts then v_now
           else cleanup_available_at
         end,
         finalize_lease_owner = null,
         finalize_lease_token = null,
         finalize_lease_expires_at = null,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'finalizing'
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
         cleanup_status = 'pending',
         cleanup_available_at = v_now,
         finalize_lease_owner = null,
         finalize_lease_token = null,
         finalize_lease_expires_at = null,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and status = 'finalizing'
     and finalize_lease_owner = p_worker_id
     and finalize_lease_token = p_lease_token
     and finalize_lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.claim_next_jhadina_upload_cleanup(
  p_worker_id text,
  p_lease_ms integer
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if nullif(trim(p_worker_id),'') is null then return null; end if;

  update public.jhadina_upload_sessions
     set status = 'expired',
         cleanup_status = 'pending',
         cleanup_available_at = v_now,
         updated_at = v_now
   where status = 'issued'
     and expires_at <= v_now;

  select id into v_id
    from public.jhadina_upload_sessions
   where (
      cleanup_status = 'pending'
      or (
        cleanup_status = 'running'
        and cleanup_lease_expires_at is not null
        and cleanup_lease_expires_at <= v_now
      )
   )
     and cleanup_available_at <= v_now
     and status in ('rejected','expired')
   order by cleanup_available_at asc, updated_at asc
   for update skip locked
   limit 1;

  if v_id is null then return null; end if;

  update public.jhadina_upload_sessions
     set cleanup_status = 'running',
         cleanup_attempt = cleanup_attempt + 1,
         cleanup_lease_owner = p_worker_id,
         cleanup_lease_token = encode(gen_random_bytes(16),'hex'),
         cleanup_lease_expires_at =
           v_now + make_interval(secs => greatest(p_lease_ms,1)::double precision / 1000),
         updated_at = v_now
   where id = v_id
   returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.complete_jhadina_upload_cleanup(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_token text
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_upload_sessions
     set cleanup_status = 'cleaned',
         cleanup_error = null,
         cleaned_at = v_now,
         cleanup_lease_owner = null,
         cleanup_lease_token = null,
         cleanup_lease_expires_at = null,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and cleanup_status = 'running'
     and cleanup_lease_owner = p_worker_id
     and cleanup_lease_token = p_lease_token
     and cleanup_lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.retry_jhadina_upload_cleanup(
  p_actor_id text,
  p_session_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_error text,
  p_available_at timestamptz
)
returns public.jhadina_upload_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.jhadina_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  update public.jhadina_upload_sessions
     set cleanup_status = 'pending',
         cleanup_available_at = greatest(p_available_at, v_now),
         cleanup_error = left(coalesce(p_error,''), 8000),
         cleanup_lease_owner = null,
         cleanup_lease_token = null,
         cleanup_lease_expires_at = null,
         updated_at = v_now
   where id = p_session_id
     and actor_id = p_actor_id
     and cleanup_status = 'running'
     and cleanup_lease_owner = p_worker_id
     and cleanup_lease_token = p_lease_token
     and cleanup_lease_expires_at > v_now
   returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.request_jhadina_upload_session_finalize(text,uuid,integer) from public,anon,authenticated;
revoke execute on function public.claim_next_jhadina_upload_session_finalize(text,integer) from public,anon,authenticated;
revoke execute on function public.retry_jhadina_upload_session_finalize(text,uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke execute on function public.claim_next_jhadina_upload_cleanup(text,integer) from public,anon,authenticated;
revoke execute on function public.complete_jhadina_upload_cleanup(text,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.retry_jhadina_upload_cleanup(text,uuid,text,text,text,timestamptz) from public,anon,authenticated;

grant execute on function public.request_jhadina_upload_session_finalize(text,uuid,integer) to service_role;
grant execute on function public.claim_next_jhadina_upload_session_finalize(text,integer) to service_role;
grant execute on function public.retry_jhadina_upload_session_finalize(text,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.claim_next_jhadina_upload_cleanup(text,integer) to service_role;
grant execute on function public.complete_jhadina_upload_cleanup(text,uuid,text,text) to service_role;
grant execute on function public.retry_jhadina_upload_cleanup(text,uuid,text,text,text,timestamptz) to service_role;
