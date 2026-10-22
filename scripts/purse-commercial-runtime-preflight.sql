-- JH-PURSE-SELF-FUND.DB-PREFLIGHT.11-.13
-- Metadata-only SELECT statements. Never execute DDL, grants, migration writes
-- or copy real data from the production database using this script.
SELECT now() AS checked_at,current_database() AS database_name,
 current_setting('transaction_read_only') AS current_connection_read_only;

-- Expected migration versions; unexpected name at the same version = collision.
WITH manifest(version,expected_name) AS (VALUES
 ('20261002190000','side_hustle_commercial_runtime'),
 ('20261003143000','side_hustle_commerce_runtime'),
 ('20261003181500','side_hustle_commissioning_evidence'),
 ('20261003221000','side_hustle_digital_product_studio_registry'))
SELECT m.version,m.expected_name,h.name AS recorded_name,
 CASE WHEN h.version IS NULL THEN 'MISSING'
      WHEN h.name<>m.expected_name THEN 'COLLISION' ELSE 'RECORDED' END AS status
FROM manifest m LEFT JOIN supabase_migrations.schema_migrations h
  ON h.version=m.version ORDER BY m.version;

WITH required(name) AS (VALUES
 ('jhadina_opportunities'),('jhadina_venture_records'),
 ('jhadina_side_hustle_work_orders'),('jhadina_side_hustle_commercial_receipts'),
 ('jhadina_side_hustle_commerce_records'),('jhadina_side_hustle_commissioning_evidence'),
 ('jhadina_digital_product_studio_records'))
SELECT r.name,c.oid IS NOT NULL AS exists,
 COALESCE(c.relrowsecurity,FALSE) AS rls_enabled,
 CASE WHEN c.oid IS NOT NULL THEN has_table_privilege('anon',c.oid,'SELECT') ELSE FALSE END AS anon_select,
 CASE WHEN c.oid IS NOT NULL THEN has_table_privilege('authenticated',c.oid,'SELECT') ELSE FALSE END AS authenticated_select,
 EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND
 p.tablename=r.name AND (p.qual LIKE '%auth.uid()%' OR p.qual LIKE '%auth.uid%'))
 AS owner_policy_present
FROM required r LEFT JOIN pg_namespace n ON n.nspname='public'
LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=r.name
 AND c.relkind IN ('r','p') ORDER BY r.name;

WITH required(name) AS (VALUES
 ('jhadina_side_hustle_work_order_save'),
 ('jhadina_side_hustle_commercial_receipt_record'),
 ('jhadina_side_hustle_commercial_transition'),
 ('jhadina_side_hustle_commerce_record_save'),
 ('jhadina_side_hustle_commissioning_evidence_record'),
 ('jhadina_digital_product_studio_record_save'))
SELECT r.name, p.oid IS NOT NULL AS exists,
 CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('anon',p.oid,'EXECUTE')
 ELSE FALSE END AS anon_execute,
 CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('authenticated',p.oid,'EXECUTE')
 ELSE FALSE END AS authenticated_execute,
 COALESCE(p.prosecdef,FALSE) AS security_definer
FROM required r LEFT JOIN pg_namespace n ON n.nspname='public'
LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=r.name ORDER BY r.name;

-- Not proof of RLS isolation. Requires separate authenticated two-user test
-- on an isolated restoration before any owner-approved production migration.
