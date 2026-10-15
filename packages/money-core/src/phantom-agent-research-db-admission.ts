import type { PhantomResearchDb } from './phantom-agent-runpod-research-ingest.js'

/**
 * PURSE-MCP.21–.23: permit database use only with a dedicated, non-owner
 * PostgreSQL role that can SELECT/INSERT wallet observations and has no
 * mutation/DDL rights on other Money / RunPod tables.
 *
 * A successful role check cannot certify network segmentation, transport TLS,
 * database backups, or the absence of other credentials on the host.
 */
export function validatePhantomResearchDatabaseUrl(url: string, generalShadowUrl?: string): string {
  let parsed: URL
  try { parsed = new URL(url) }
  catch { throw new Error('PHANTOM_RESEARCH_DATABASE_URL_INVALID') }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !parsed.hostname || !parsed.username || !parsed.password ||
      !parsed.pathname || parsed.pathname === '/' ||
      parsed.searchParams.get('sslmode') !== 'verify-full' ||
      parsed.hash || (generalShadowUrl && url === generalShadowUrl)) {
    throw new Error('PHANTOM_RESEARCH_DATABASE_DEDICATED_TLS_REQUIRED')
  }
  return url
}

export async function assertPhantomResearchDatabaseRole(db: PhantomResearchDb) {
  const result = await db.query(`
    SELECT
      current_user AS role_name,
      r.rolsuper AS is_superuser,
      r.rolbypassrls AS bypasses_rls,
      r.rolcreaterole AS can_create_role,
      r.rolcreatedb AS can_create_db,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema_objects,
      has_table_privilege(current_user, 'public.runpod_phantom_agent_research_observations', 'SELECT') AS can_read_research,
      has_table_privilege(current_user, 'public.runpod_phantom_agent_research_observations', 'INSERT') AS can_insert_research,
      has_table_privilege(current_user, 'public.runpod_phantom_agent_research_observations', 'UPDATE') AS can_update_research,
      has_table_privilege(current_user, 'public.runpod_phantom_agent_research_observations', 'DELETE') AS can_delete_research,
      has_table_privilege(current_user, 'public.runpod_phantom_agent_research_observations', 'TRUNCATE') AS can_truncate_research,
      EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p')
          AND (c.relname LIKE 'money_%' OR c.relname LIKE 'runpod_%')
          AND c.relname <> 'runpod_phantom_agent_research_observations'
          AND has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
      ) AS can_mutate_other_money_tables
    FROM pg_roles r WHERE r.rolname=current_user
  `)
  const row = result.rows[0]
  if (result.rows.length !== 1 || !row ||
      typeof row.role_name !== 'string' || row.role_name === 'postgres' ||
      row.is_superuser !== false || row.bypasses_rls !== false ||
      row.can_create_role !== false || row.can_create_db !== false ||
      row.can_create_schema_objects !== false ||
      row.can_read_research !== true || row.can_insert_research !== true ||
      row.can_update_research !== false || row.can_delete_research !== false ||
      row.can_truncate_research !== false || row.can_mutate_other_money_tables !== false) {
    throw new Error('PHANTOM_RESEARCH_DATABASE_ROLE_NOT_ISOLATED')
  }
  return Object.freeze({
    checked: true as const,
    scope: 'RESEARCH_SELECT_INSERT_ONLY' as const,
    authority: 'OBSERVATION_ONLY' as const,
    canExecute: false as const,
    canAuthorizeLive: false as const,
    productionCertified: false as const,
  })
}
