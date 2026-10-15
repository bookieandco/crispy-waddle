-- BIZ-PURSE.01: read-only. No privilege grants or migrations.
with expected_tables(name) as (
  values ('jhadina_side_hustle_work_orders'),
         ('jhadina_side_hustle_commercial_receipts'),
         ('jhadina_side_hustle_commerce_records'),
         ('jhadina_side_hustle_commissioning_evidence'),
         ('jhadina_digital_product_studio_records')
), expected_functions(name,signature) as (
  values ('jhadina_side_hustle_work_order_save','jsonb'),
         ('jhadina_side_hustle_commercial_receipt_record','jsonb'),
         ('jhadina_side_hustle_commercial_transition','jsonb,jsonb'),
         ('jhadina_side_hustle_commerce_record_save','text,jsonb'),
         ('jhadina_side_hustle_commissioning_evidence_record','jsonb'),
         ('jhadina_digital_product_studio_record_save','jsonb')
)
select jsonb_build_object(
  'observedAt', now(),
  'migrations',(select coalesce(jsonb_agg(version::text),'[]'::jsonb) from supabase_migrations.schema_migrations),
  'relations',(select jsonb_object_agg(name,to_regclass(format('public.%I',name)) is not null) from expected_tables),
  'functions',(select jsonb_object_agg(name,to_regprocedure(format('public.%I(%s)',name,signature)) is not null) from expected_functions),
  'rls',(select jsonb_object_agg(t.name,coalesce(c.relrowsecurity,false))
         from expected_tables t
         left join pg_class c on c.oid=to_regclass(format('public.%I',t.name)))
) as biz_purse_readonly_probe;
