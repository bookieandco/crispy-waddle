#!/usr/bin/env bash
# SOCIAL-CORE.RECOVER.07 — disposable PostgreSQL only. Never production.
set -euo pipefail
HOST="${PGHOST:-127.0.0.1}"
DB="${PGDATABASE:-social_recover_ci}"
[[ "$HOST" == 127.0.0.1 || "$HOST" == localhost ]] || { echo "SOCIAL_ACCEPT_LOOPBACK_ONLY" >&2; exit 1; }
[[ "$DB" == social_recover_ci ]] || { echo "SOCIAL_ACCEPT_DISPOSABLE_DB_ONLY" >&2; exit 1; }
export PGHOST="$HOST" PGDATABASE="$DB" PGUSER="${PGUSER:-postgres}" PGPORT="${PGPORT:-5432}" PGPASSWORD="${PGPASSWORD:-social-ci-disposable-only}"
command -v psql >/dev/null || { echo "SOCIAL_ACCEPT_PSQL_REQUIRED" >&2; exit 1; }
# Require a brand-new disposable fixture database, not any preexisting data.
TABLES=$(psql -X -A -t -v ON_ERROR_STOP=1 -c "select count(*) from pg_tables where schemaname='public' and tablename like 'jhadina_social_%'")
[[ "$TABLES" == 0 ]] || { echo "SOCIAL_ACCEPT_NONEMPTY_TARGET_FORBIDDEN" >&2; exit 1; }

psql -X -v ON_ERROR_STOP=1 <<'SQL'
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema auth to authenticated, anon, service_role;
create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid
  language sql stable
  as $body$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$body$;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
SQL

# Exercise the original real SQL migrations from the repository (not fixtures).
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260921214803_jhadina_social_governed_publication.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260921230450_jhadina_social_governed_messages.sql

psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $pre$
begin
 if not has_function_privilege('authenticated',
   'public.jhadina_social_approve_receipt(uuid)','EXECUTE')
 then raise exception 'SOCIAL_PRE_CUTOVER_TEST_IS_INVALID'; end if;
end
$pre$;
-- Insert only synthetic same-structure accounts for two test owners.
insert into public.jhadina_social_accounts(user_id,brand,provider,provider_profile_id,platform,display_name)
values
 ('11111111-1111-4111-8111-111111111111','pupsonstuff','fixture','owner-a','instagram','Owner A'),
 ('22222222-2222-4222-8222-222222222222','pupsonstuff','fixture','owner-b','instagram','Owner B');
SQL

# Apply only the uncommissioned SQL proposal in an isolated database.
psql -X -v ON_ERROR_STOP=1 -f supabase/proposals/social_core_recover_06_server_mutation_UNAPPLIED.sql

psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $acl$
declare x record;
begin
  -- All 19 direct public mutation functions and account-binding must be
  -- inaccessible from authenticated/anon even when they know a function name.
  for x in
    select p.oid,p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'jhadina_social_%'
    and p.proname not in ('jhadina_social_refresh_proposal_status',
                         'jhadina_social_server_mutation')
  loop
    if has_function_privilege('authenticated',x.oid,'EXECUTE')
      or has_function_privilege('anon',x.oid,'EXECUTE')
    then raise exception 'SOCIAL_DIRECT_RPC_GRANT_LEAK:%',x.proname; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname like 'jhadina_social_%'
         and p.proname not in ('jhadina_social_refresh_proposal_status',
                              'jhadina_social_server_mutation')) != 20
  then raise exception 'SOCIAL_MIGRATION_FUNCTION_SET_DRIFT'; end if;
  if has_function_privilege('authenticated',
    'public.jhadina_social_server_mutation(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('anon',
    'public.jhadina_social_server_mutation(uuid,text,jsonb)','EXECUTE')
     or not has_function_privilege('service_role',
    'public.jhadina_social_server_mutation(uuid,text,jsonb)','EXECUTE')
  then raise exception 'SOCIAL_SERVER_DISPATCHER_GRANTS_INVALID'; end if;
end
$acl$;
SQL

# A real authenticated owner can read only their RLS-protected account rows;
# cannot call the receipt RPC OR its protected service dispatcher.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $auth_owner$
declare visible integer;
begin
  select count(*) into visible from public.jhadina_social_accounts;
  if visible != 1 then raise exception 'SOCIAL_OWNER_A_RLS_FAILED:%',visible; end if;
  begin
    perform public.jhadina_social_approve_receipt('11111111-1111-4111-8111-111111111111');
    raise exception 'SOCIAL_OWNER_DIRECT_RPC_ALLOWED';
  exception when insufficient_privilege then null; end;
  begin
    perform public.jhadina_social_server_mutation(
      '11111111-1111-4111-8111-111111111111','jhadina_social_create_approval_receipt','{}'::jsonb);
    raise exception 'SOCIAL_OWNER_SERVER_DISPATCHER_ALLOWED';
  exception when insufficient_privilege then null; end;
end
$auth_owner$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $owner_b$
declare visible integer;
begin
  select count(*) into visible from public.jhadina_social_accounts;
  if visible != 1 then raise exception 'SOCIAL_OWNER_B_RLS_FAILED:%',visible; end if;
end
$owner_b$;
rollback;

begin;
set local role anon;
do $anonymous$
begin
  -- The original schema may deny anonymous SELECT at the GRANT level.
  -- Either permission denied or zero visible RLS rows is acceptable.
  begin
    if (select count(*) from public.jhadina_social_accounts) != 0
      then raise exception 'SOCIAL_ANON_RLS_FAILED'; end if;
  exception when insufficient_privilege then null; end;
  begin
    perform public.jhadina_social_server_mutation(null,'jhadina_social_create_approval_receipt','{}'::jsonb);
    raise exception 'SOCIAL_ANON_SERVER_DISPATCHER_ALLOWED';
  exception when insufficient_privilege then null; end;
end
$anonymous$;
rollback;
SQL

# Service-only, transaction-local owner context; originals perform all checks.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
set local role service_role;
do $service$
declare owner_a constant uuid:='11111111-1111-4111-8111-111111111111';
        owner_b constant uuid:='22222222-2222-4222-8222-222222222222';
        approval_id uuid;
        receipt jsonb;
        approval jsonb;
        result jsonb;
begin
  receipt := public.jhadina_social_server_mutation(owner_a,
    'jhadina_social_create_approval_receipt',jsonb_build_object(
       'p_action_id','social-public-publish:test-owner-a',
       'p_type','public.publish','p_fingerprint','fingerprint-a',
       'p_expires_at',(now()+interval '5 minutes')::text));
  approval_id := (receipt->>'id')::uuid;
  if receipt->>'user_id' != owner_a::text or receipt->>'status' != 'pending'
    then raise exception 'SOCIAL_SERVER_OWNER_CONTEXT_WRONG'; end if;

  -- Different owner cannot approve owner A's receipt; catches owner-confusion.
  begin
    approval := public.jhadina_social_server_mutation(owner_b,
      'jhadina_social_approve_receipt',jsonb_build_object('p_receipt_id',approval_id));
    raise exception 'SOCIAL_FOREIGN_OWNER_APPROVAL_ACCEPTED';
  exception when raise_exception then
    if SQLERRM='SOCIAL_FOREIGN_OWNER_APPROVAL_ACCEPTED'
      then raise; end if;
  end;

  approval := public.jhadina_social_server_mutation(owner_a,
    'jhadina_social_approve_receipt',jsonb_build_object('p_receipt_id',approval_id));
  if approval->>'status' != 'approved' then raise exception 'SOCIAL_APPROVAL_NOT_APPROVED'; end if;

  result:=public.jhadina_social_server_mutation(owner_a,
    'jhadina_social_consume_approval_receipt',jsonb_build_object(
       'p_receipt_id',approval_id,'p_action_id','social-public-publish:test-owner-a',
       'p_type','public.publish','p_fingerprint','wrong-fingerprint'));
  if result != 'false'::jsonb then raise exception 'SOCIAL_WRONG_FINGERPRINT_ACCEPTED'; end if;

  result:=public.jhadina_social_server_mutation(owner_b,
    'jhadina_social_consume_approval_receipt',jsonb_build_object(
       'p_receipt_id',approval_id,'p_action_id','social-public-publish:test-owner-a',
       'p_type','public.publish','p_fingerprint','fingerprint-a'));
  if result != 'false'::jsonb then raise exception 'SOCIAL_FOREIGN_OWNER_CONSUMPTION_ACCEPTED'; end if;

  result:=public.jhadina_social_server_mutation(owner_a,
    'jhadina_social_consume_approval_receipt',jsonb_build_object(
       'p_receipt_id',approval_id,'p_action_id','social-public-publish:test-owner-a',
       'p_type','public.publish','p_fingerprint','fingerprint-a'));
  if result != 'true'::jsonb then raise exception 'SOCIAL_CORRECT_APPROVAL_DENIED'; end if;
  result:=public.jhadina_social_server_mutation(owner_a,
    'jhadina_social_consume_approval_receipt',jsonb_build_object(
       'p_receipt_id',approval_id,'p_action_id','social-public-publish:test-owner-a',
       'p_type','public.publish','p_fingerprint','fingerprint-a'));
  if result != 'false'::jsonb then raise exception 'SOCIAL_APPROVAL_REPLAY_ACCEPTED'; end if;
  if (select status from public.jhadina_social_approval_receipts where id=approval_id)!='consumed'
    then raise exception 'SOCIAL_APPROVAL_FINAL_STATUS_WRONG'; end if;
  begin
    result:=public.jhadina_social_server_mutation(owner_a,'sql.execute','{}'::jsonb);
    raise exception 'SOCIAL_GENERIC_SQL_OPERATION_ACCEPTED';
  exception when raise_exception then
    if SQLERRM='SOCIAL_GENERIC_SQL_OPERATION_ACCEPTED' then raise; end if;
  end;
end
$service$;
rollback;
SQL

echo "SOCIAL_CORE_RECOVER_07_DISPOSABLE_POSTGRES_PASS"
