-- Rollback-only WorkSession recovery probe. No provider or scheduler is invoked.
begin;
set local role service_role;
do $probe$
declare
  sid text := 'completion-recovery-probe-20261003';
  owner_id uuid := '00000000-0000-4000-8000-000000000301';
  foreign_id uuid := '00000000-0000-4000-8000-000000000302';
  a public.jhadina_work_session_tasks%rowtype;
  b public.jhadina_work_session_tasks%rowtype;
  n integer;
begin
  insert into public.jhadina_work_sessions(id,owner_user_id,goal,status)
  values(sid,owner_id,'Rollback-only recovery verification','active');
  insert into public.jhadina_work_session_tasks
    (id,work_session_id,owner_user_id,domain,capability,status,authority_ref,idempotency_key,correlation_id)
  values('probe',sid,owner_id,'verification','read-only-probe','ready','probe:no-external-authority',sid,sid);

  select count(*) into n from public.jhadina_claim_work_session_task(sid,'probe',foreign_id,'foreign',60000);
  if n<>0 then raise exception 'foreign owner claim admitted'; end if;
  select * into a from public.jhadina_claim_work_session_task(sid,'probe',owner_id,'worker-a',60000);
  if a.id is null or a.attempt<>1 or a.status<>'running' then raise exception 'initial claim failed'; end if;
  select count(*) into n from public.jhadina_claim_work_session_task(sid,'probe',owner_id,'worker-b',60000);
  if n<>0 then raise exception 'concurrent worker claim admitted'; end if;

  -- Expire only this uncommitted test lease to model a crashed worker.
  update public.jhadina_work_session_tasks set lease_expires_at=clock_timestamp()-interval '1 second'
  where work_session_id=sid and id='probe' and owner_user_id=owner_id;
  select count(*) into n from public.jhadina_release_work_session_task_lease(sid,'probe',owner_id,'worker-a',a.lease_token,'completed',null);
  if n<>0 then raise exception 'expired worker completion admitted'; end if;
  select * into b from public.jhadina_claim_work_session_task(sid,'probe',owner_id,'worker-b',60000);
  if b.id is null or b.attempt<>2 or b.lease_token=a.lease_token then raise exception 'reclaim failed'; end if;
  select count(*) into n from public.jhadina_renew_work_session_task_lease(sid,'probe',owner_id,'worker-a',a.lease_token,60000);
  if n<>0 then raise exception 'stale worker renewal admitted'; end if;
  select count(*) into n from public.jhadina_release_work_session_task_lease(sid,'probe',owner_id,'worker-a',a.lease_token,'completed',null);
  if n<>0 then raise exception 'stale worker completion admitted'; end if;
  select count(*) into n from public.jhadina_renew_work_session_task_lease(sid,'probe',owner_id,'worker-b',b.lease_token,60000);
  if n<>1 then raise exception 'current worker renewal failed'; end if;
  select count(*) into n from public.jhadina_release_work_session_task_lease(sid,'probe',owner_id,'worker-b',b.lease_token,'completed',null);
  if n<>1 then raise exception 'current worker completion failed'; end if;
  select count(*) into n from public.jhadina_claim_work_session_task(sid,'probe',owner_id,'worker-c',60000);
  if n<>0 then raise exception 'completed task reclaimed'; end if;
  if not exists(select 1 from public.jhadina_work_session_tasks where work_session_id=sid and id='probe'
     and status='completed' and attempt=2 and lease_token is null and lease_owner is null)
  then raise exception 'completion readback failed'; end if;
end;
$probe$;
select 'PASS' as recovery_probe, status, attempt, lease_owner is null as lease_released
from public.jhadina_work_session_tasks where work_session_id='completion-recovery-probe-20261003';
rollback;
