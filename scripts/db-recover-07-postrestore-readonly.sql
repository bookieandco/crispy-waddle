-- DB-RECOVER.07: read-only SWLC after-restore catalog/RLS and grant audit.
-- Presence + RLS metadata do NOT prove source migration execution or data custody.
with expected(name) as (values
 ('jhadina_side_hustle_work_orders'),
 ('jhadina_side_hustle_commercial_receipts'),
 ('jhadina_side_hustle_commerce_records'),
 ('jhadina_side_hustle_commissioning_evidence'),
 ('jhadina_digital_product_studio_records')
),base as(
 select e.name,c.oid,c.relrowsecurity,c.relforcerowsecurity,
  c.relkind,coalesce(n.nspname,'public') as schema_name
 from expected e
 left join pg_catalog.pg_class c on c.oid=to_regclass(format('public.%I',e.name))
 left join pg_catalog.pg_namespace n on n.oid=c.relnamespace
),report as(
 select name,oid is not null as exists_in_public,
  coalesce(relrowsecurity,false) as rls_enabled,
  coalesce(relforcerowsecurity,false) as rls_forced,
  coalesce((select count(*) from pg_catalog.pg_policies p
     where p.schemaname='public' and p.tablename=b.name),0) as policy_count,
  case when oid is null then null
   else has_table_privilege('anon',oid,'SELECT') end as anon_can_select,
  case when oid is null then null
   else has_table_privilege('authenticated',oid,'SELECT') end as authenticated_can_select,
  case when oid is null then null
   else has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE') end as authenticated_can_write_any
 from base b
)
select jsonb_build_object('observedAt',now(),'readOnly',true,'projectExpected','kqbkaozfjubkjevdfvic',
 'allFivePresent',(select bool_and(exists_in_public) from report),
 'tables',(select jsonb_agg(to_jsonb(report) order by name) from report),
 'readyForProductionCertification',false,
 'requiresIndependentRestoreAndOwnerRlsTests',true) as db_recover_07_catalog_audit;
