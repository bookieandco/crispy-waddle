-- BIZ-PURSE.14: live-safe read-only SECURITY/GRANT inventory.
-- A successful result is not equivalent to an authenticated two-user RLS test.
with relations(name) as (values
 ('jhadina_side_hustle_work_orders'),
 ('jhadina_side_hustle_commercial_receipts'),
 ('jhadina_side_hustle_commerce_records'),
 ('jhadina_side_hustle_commissioning_evidence'),
 ('jhadina_digital_product_studio_records')
),
rpcs(name,signature) as (values
 ('jhadina_side_hustle_work_order_save','jsonb'),
 ('jhadina_side_hustle_commercial_receipt_record','jsonb'),
 ('jhadina_side_hustle_commercial_transition','jsonb,jsonb'),
 ('jhadina_side_hustle_commerce_record_save','text,jsonb'),
 ('jhadina_side_hustle_commissioning_evidence_record','jsonb'),
 ('jhadina_digital_product_studio_record_save','jsonb')
)
select jsonb_build_object(
 'observed_at',now(),
 'relations',(select coalesce(jsonb_agg(jsonb_build_object(
  'name',r.name,'present',c.oid is not null,'rls_enabled',coalesce(c.relrowsecurity,false),
  'anon_select',case when c.oid is not null then has_table_privilege('anon',c.oid,'SELECT') else null end,
  'authenticated_select',case when c.oid is not null then has_table_privilege('authenticated',c.oid,'SELECT') else null end,
  'authenticated_insert',case when c.oid is not null then has_table_privilege('authenticated',c.oid,'INSERT') else null end
 ) order by r.name),'[]'::jsonb)
 from relations r left join pg_class c on c.oid=to_regclass(format('public.%I',r.name))),
 'rpcs',(select coalesce(jsonb_agg(jsonb_build_object(
  'name',f.name,'signature',f.signature,'present',p.oid is not null,
  'security_definer',coalesce(p.prosecdef,false),
  'anon_execute',case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') else null end,
  'authenticated_execute',case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') else null end,
  'search_path',coalesce((select substring(setting from '^search_path=(.*)$') from unnest(p.proconfig) setting where setting like 'search_path=%' limit 1),null)
 ) order by f.name),'[]'::jsonb)
 from rpcs f left join pg_proc p on p.oid=to_regprocedure(format('public.%I(%s)',f.name,f.signature)))
) as biz_purse_security_probe;
