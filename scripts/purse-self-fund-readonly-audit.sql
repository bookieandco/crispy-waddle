-- JH-PURSE-SELF-FUND.RECOVER.03
-- READ ONLY: no DDL, no grants, no writes, no production-release inference.
-- Run on the intended Supabase/Postgres database with a read-only connection.
WITH required(table_name) AS (
  VALUES
    ('jhadina_side_hustle_work_orders'),
    ('jhadina_side_hustle_commercial_receipts'),
    ('jhadina_side_hustle_commerce_records'),
    ('jhadina_side_hustle_commissioning_evidence'),
    ('jhadina_digital_product_studio_records'),
    ('money_coffers'),
    ('money_purse_charters'),
    ('money_profit_sweep_policies')
)
SELECT
  current_database() AS database_name,
  now() AS observed_at,
  current_setting('transaction_read_only') AS connection_read_only,
  r.table_name,
  c.oid IS NOT NULL AS exists_in_public,
  COALESCE(c.relrowsecurity, FALSE) AS rls_enabled,
  CASE WHEN c.oid IS NOT NULL THEN has_table_privilege('anon',c.oid,'SELECT') ELSE FALSE END AS anon_select_granted,
  CASE WHEN c.oid IS NOT NULL THEN has_table_privilege('authenticated',c.oid,'SELECT') ELSE FALSE END AS authenticated_select_granted,
  CASE WHEN c.oid IS NOT NULL THEN
    (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=r.table_name)
    ELSE 0 END AS policy_count
FROM required r
LEFT JOIN pg_namespace n ON n.nspname='public'
LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=r.table_name AND c.relkind IN ('r','p')
ORDER BY r.table_name;

-- Historical migration versions alone do not prove an independent restore.
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 30;

-- Deliberately no provider credentials, identifiers of customers, or wallet addresses.
SELECT
  rail_id, environment, admission,
  max_movement_minor, max_daily_movement_minor,
  commissioning_certificate_id
FROM public.money_funding_rail_admissions
ORDER BY updated_at DESC LIMIT 10;
