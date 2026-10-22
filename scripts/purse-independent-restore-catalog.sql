-- JH-PURSE-RESTORE CATALOG V1
-- READ ONLY; run separately against source Jhadina PG17 and the
-- independently restored, private, isolated PG17 target.
-- No customer rows, secrets, role passwords, grants, DDL or mutations.
-- Save the single JSON result only to privately controlled local files.
SELECT jsonb_build_object(
  'kind','pg17-source-catalog-v1',
  'capturedAt',clock_timestamp(),
  'major',current_setting('server_version_num')::integer/10000,
  'database',current_database(),
  'extensions',COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname)
    FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
  ),'[]'::jsonb),
  'tables',COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,
      'policyCount',(SELECT count(*)::integer FROM pg_policies p
                     WHERE p.schemaname=n.nspname AND p.tablename=c.relname),
      -- MD5 here is only a drift fingerprint, never cryptographic proof.
      'policyHash',md5(COALESCE((
        SELECT string_agg(
          p.policyname||':'||p.permissive||':'||array_to_string(p.roles,',')||
          ':'||p.cmd||':'||COALESCE(p.qual,'')||':'||COALESCE(p.with_check,''),
          '|' ORDER BY p.policyname,p.cmd
        ) FROM pg_policies p
        WHERE p.schemaname=n.nspname AND p.tablename=c.relname
      ),''))) ORDER BY n.nspname,c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname IN (
      'public','auth','storage','realtime','vault','supabase_migrations')
  ),'[]'::jsonb),
  'roles',COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name',r.rolname,'canLogin',r.rolcanlogin,
      'superuser',r.rolsuper,'bypassRls',r.rolbypassrls)
      ORDER BY r.rolname)
    FROM pg_roles r WHERE r.rolname IN (
      'anon','authenticated','authenticator','service_role',
      'postgres','supabase_admin','supabase_auth_admin',
      'supabase_storage_admin','dashboard_user')
  ),'[]'::jsonb),
  'migrations',COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'version',m.version,'name',COALESCE(m.name,'')) ORDER BY m.version)
    FROM supabase_migrations.schema_migrations m
  ),'[]'::jsonb)
)::text AS catalog_json;
