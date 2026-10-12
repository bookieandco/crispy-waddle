\set ON_ERROR_STOP on

-- These roles and tables are created only in the isolated CI PostgreSQL service.
-- Import the real historical table/function migrations, then the staged fix.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$roles$;

\ir ../../supabase/migrations/20260920170000_create_jhadina_safety_runtime.sql
\ir ../../supabase/migrations/20260920174500_safety_drill_2_runtime.sql
\ir ../../ops/sql/SAFETY-DEADMAN-CONFLICT-ARBITER-STAGED-NOT-APPLIED.sql

-- Verify target constraint and explicit least privilege.
do $test$
declare
  f regprocedure := 'public.claim_due_jhadina_safety_incidents(timestamptz,integer,integer)'::regprocedure;
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.jhadina_safety_deadman_leases'::regclass
      and c.conname = 'jhadina_safety_deadman_leases_pkey'
      and c.contype = 'p'
  ) then raise exception 'expected primary key constraint missing'; end if;
  if not (select prosecdef from pg_proc where oid = f) then
    raise exception 'expected SECURITY DEFINER was not preserved';
  end if;
  if has_function_privilege('anon',f,'execute')
    or has_function_privilege('authenticated',f,'execute')
    or not has_function_privilege('service_role',f,'execute')
  then raise exception 'privileged function execution grants regressed'; end if;
  if (select count(*) from pg_class
      where oid in ('public.jhadina_safety_deadman_leases'::regclass,
                    'public.jhadina_safety_incidents'::regclass)
        and relrowsecurity) <> 2
  then raise exception 'RLS was disabled'; end if;
end;
$test$;

-- Empty queue must not create anything.
do $test$
begin
  if (select count(*) from public.claim_due_jhadina_safety_incidents(
    '2026-10-12T12:00:00Z'::timestamptz,120,50)) <> 0
  then raise exception 'empty queue should not be claimable'; end if;
end;
$test$;

insert into public.jhadina_safety_incidents
(incident_id,owner_id,protocol_id,dead_man_state,deadline_at)
values
('incident_a','owner-test','protocol-test','armed','2026-10-12T11:00:00Z'),
('incident_b','owner-test','protocol-test','armed','2026-10-12T11:00:00Z'),
('incident_future','owner-test','protocol-test','armed','2026-10-12T13:00:00Z'),
('incident_closed','owner-test','protocol-test','resolved','2026-10-12T09:00:00Z'),
('incident_cancelled','owner-test','protocol-test','cancelled','2026-10-12T09:00:00Z'),
('incident_disarmed','owner-test','protocol-test','disarmed','2026-10-12T09:00:00Z');

-- p_limit must hold, even when there are two due incidents.
do $test$
declare
  first_claim record;
  second_claim record;
  returned_count integer;
begin
  select * into first_claim from public.claim_due_jhadina_safety_incidents(
    '2026-10-12T12:00:00Z'::timestamptz,120,1);
  if first_claim.incident_id is distinct from 'incident_a'
    or first_claim.lease_id is null
    or first_claim.leased_until is distinct from '2026-10-12T12:02:00Z'::timestamptz
  then raise exception 'first claim mismatch'; end if;
  select * into second_claim from public.claim_due_jhadina_safety_incidents(
    '2026-10-12T12:00:00Z'::timestamptz,120,1);
  if second_claim.incident_id is distinct from 'incident_b'
    or second_claim.lease_id is null
    or second_claim.lease_id = first_claim.lease_id
  then raise exception 'limit, priority, or uniqueness failed'; end if;
  select count(*) into returned_count from public.claim_due_jhadina_safety_incidents(
    '2026-10-12T12:00:00Z'::timestamptz,120,50);
  if returned_count <> 0 then
    raise exception 'active leases were double-claimed';
  end if;
  if (select count(*) from public.jhadina_safety_deadman_leases) <> 2 then
    raise exception 'excluded or future incident received a lease'; end if;
  -- Expired lease on incident_a can be re-claimed without duplicate ledger rows.
  select * into second_claim from public.claim_due_jhadina_safety_incidents(
    '2026-10-12T12:03:00Z'::timestamptz,120,1);
  if second_claim.incident_id is distinct from 'incident_a'
    or second_claim.lease_id = first_claim.lease_id
    or second_claim.leased_until is distinct from '2026-10-12T12:05:00Z'::timestamptz
  then raise exception 'expired lease not safely reclaimed'; end if;
  if (select count(*) from public.jhadina_safety_deadman_leases) <> 2 then
    raise exception 'lease conflict produced duplicate rows'; end if;
end;
$test$;

-- The SQL repair must not send alerts or create delivery receipts.
do $test$
begin
  if (select count(*) from public.jhadina_safety_delivery_receipts) <> 0 then
    raise exception 'lease repair unexpectedly sent or recorded a delivery';
  end if;
end;
$test$;

\echo SAFETY-DEADMAN isolated SQL regression PASSED
