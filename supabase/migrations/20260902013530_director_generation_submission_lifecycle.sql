create or replace function public.claim_director_generation_submission(p_submission_id uuid, p_worker_id text, p_lease_ms integer)
returns public.director_generation_submission_outbox
language plpgsql security definer set search_path = public
as $$
declare v_row public.director_generation_submission_outbox%rowtype; v_now timestamptz := clock_timestamp();
begin
 select * into v_row from public.director_generation_submission_outbox where id=p_submission_id for update;
 if not found then return null; end if;
 if v_row.status='submitted' then return v_row; end if;
 if v_row.lease_expires_at is not null and v_row.lease_expires_at > v_now then return null; end if;
 update public.director_generation_submission_outbox set status='submitting', attempt=attempt+1, lease_owner=p_worker_id, lease_token=encode(gen_random_bytes(16),'hex'), lease_expires_at=v_now + make_interval(secs => greatest(p_lease_ms,1)::double precision / 1000), updated_at=v_now where id=p_submission_id returning * into v_row;
 return v_row;
end; $$;

create or replace function public.renew_director_generation_submission_lease(p_submission_id uuid,p_worker_id text,p_lease_token text,p_lease_ms integer)
returns public.director_generation_submission_outbox
language plpgsql security definer set search_path=public
as $$
declare v_row public.director_generation_submission_outbox%rowtype; v_now timestamptz:=clock_timestamp();
begin
 update public.director_generation_submission_outbox set lease_expires_at=v_now + make_interval(secs => greatest(p_lease_ms,1)::double precision / 1000), updated_at=v_now where id=p_submission_id and status='submitting' and lease_owner=p_worker_id and lease_token=p_lease_token and lease_expires_at > v_now returning * into v_row;
 return v_row;
end; $$;

create or replace function public.ack_director_generation_submission(p_submission_id uuid,p_worker_id text,p_lease_token text,p_provider_job_id text)
returns public.director_generation_submission_outbox
language plpgsql security definer set search_path=public
as $$
declare v_row public.director_generation_submission_outbox%rowtype;
begin
 update public.director_generation_submission_outbox set status='submitted',provider_job_id=p_provider_job_id,lease_owner=null,lease_token=null,lease_expires_at=null,updated_at=clock_timestamp() where id=p_submission_id and status='submitting' and lease_owner=p_worker_id and lease_token=p_lease_token returning * into v_row;
 return v_row;
end; $$;

create or replace function public.recover_director_generation_submission(p_submission_id uuid,p_worker_id text,p_lease_token text,p_error text)
returns public.director_generation_submission_outbox
language plpgsql security definer set search_path=public
as $$
declare v_row public.director_generation_submission_outbox%rowtype;
begin
 update public.director_generation_submission_outbox set status='recovery_required',last_error=p_error,lease_owner=null,lease_token=null,lease_expires_at=null,updated_at=clock_timestamp() where id=p_submission_id and status='submitting' and lease_owner=p_worker_id and lease_token=p_lease_token returning * into v_row;
 return v_row;
end; $$;

revoke execute on function public.claim_director_generation_submission(uuid,text,integer) from public,anon,authenticated;
revoke execute on function public.renew_director_generation_submission_lease(uuid,text,text,integer) from public,anon,authenticated;
revoke execute on function public.ack_director_generation_submission(uuid,text,text,text) from public,anon,authenticated;
revoke execute on function public.recover_director_generation_submission(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_director_generation_submission(uuid,text,integer) to service_role;
grant execute on function public.renew_director_generation_submission_lease(uuid,text,text,integer) to service_role;
grant execute on function public.ack_director_generation_submission(uuid,text,text,text) to service_role;
grant execute on function public.recover_director_generation_submission(uuid,text,text,text) to service_role;
