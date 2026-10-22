-- SOCIAL-CORE.RECOVER.09 — READ ONLY; intended for reviewed exact-project
-- Supabase SQL Editor or a service owner using a read-only database session.
-- No auth.users content, profiles, private messages, tokens, or customer rows.
-- DO NOT "repair" drift by editing schema_migrations.
--
-- Query 1: Public Social RPCs and shared Action audit authority.
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and (p.proname like 'jhadina_social_%'
     or p.proname='append_jhadina_audit_event')
 order by 1;

-- Query 2: Explicit release gates. These values are never a grant of
-- authorization: status 'FAIL' means no real Social mutation cutover.
with rpc as (
  select p.proname,
         has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_can_execute,
         has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
         has_function_privilege('service_role',p.oid,'EXECUTE') as service_can_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and (p.proname like 'jhadina_social_%' or p.proname='append_jhadina_audit_event')
), allowed as (
  select 'jhadina_social_' || unnest(array[
    'upsert_account','create_proposal','create_approval_receipt',
    'attach_approval_receipt','approve_receipt','consume_approval_receipt',
    'enqueue_outbox','begin_outbox_attempt','complete_outbox','fail_outbox',
    'record_observation','publish_canary_create','publish_canary_capture_outbox',
    'upsert_contact_state','create_message_proposal',
    'attach_message_approval','enqueue_message_outbox','begin_message_attempt',
    'complete_message_outbox','fail_message_outbox'
  ]) as proname
)
select
  (select count(*) from allowed) as expected_mutation_functions,
  (select count(*) from allowed a join rpc r on r.proname=a.proname) as existing_mutation_functions,
  (select count(*) from allowed a join rpc r on r.proname=a.proname
    where r.auth_can_execute or r.anon_can_execute) as client_executable_mutations,
  exists(select 1 from rpc where proname='jhadina_social_server_mutation'
    and service_can_execute and not auth_can_execute and not anon_can_execute)
    as service_only_dispatcher_present,
  exists(select 1 from rpc where proname='append_jhadina_audit_event'
    and auth_can_execute) as shared_audit_append_exposed;

-- Query 3: Drift and feature foundations, without reading row data.
select version,name
  from supabase_migrations.schema_migrations
 where name in (
  'jhadina_social_governed_publication',
  'social_prod_schema_reconciliation',
  'jhadina_social_governed_messages',
  'transcript_fold_runtime_1',
  'transcript_fold_runtime_1_indexes',
  'social_presence_runtime_1'
 ) order by version;

select to_regclass('public.jhadina_social_studio_workspaces') is not null
  as studio_table_present,
       (select md5(pg_get_functiondef(p.oid))
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname='append_jhadina_audit_event'
         limit 1) as current_audit_function_source_hash;
