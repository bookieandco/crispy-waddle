import { GevProviderBridge } from '@jhadina/spatial-intelligence-core'
import { createServiceRoleClient } from '../supabase/service-role'

export type SpatialProductionHealth = {
  status: 'READY' | 'DEGRADED'
  checkedAt: string
  provider: {
    configured: boolean
    reachable: boolean
  }
  database: {
    configured: boolean
    reachable: boolean
    tables: Record<string, boolean>
  }
  deployment: {
    environment: string | null
    commitSha: string | null
  }
}

const SPATIAL_TABLES = [
  'jhadina_spatial_evidence',
  'jhadina_spatial_reality_candidates',
  'jhadina_spatial_reality_admissions',
  'jhadina_spatial_workspace_revisions',
  'jhadina_knowledge_nodes',
  'jhadina_knowledge_relations',
] as const

async function checkProvider(baseUrl: string | undefined): Promise<{ configured: boolean; reachable: boolean }> {
  if (!baseUrl) return { configured: false, reachable: false }
  try {
    const bridge = new GevProviderBridge({ baseUrl, timeoutMs: 3_000 })
    await bridge.cctvHealth('private-analysis')
    return { configured: true, reachable: true }
  } catch {
    return { configured: true, reachable: false }
  }
}

async function checkDatabase(): Promise<SpatialProductionHealth['database']> {
  const client = createServiceRoleClient()
  if (!client) {
    return {
      configured: false,
      reachable: false,
      tables: Object.fromEntries(SPATIAL_TABLES.map((table) => [table, false])),
    }
  }

  const checks = await Promise.all(SPATIAL_TABLES.map(async (table) => {
    const { error } = await client.from(table).select('*', { count: 'exact', head: true })
    return [table, !error] as const
  }))

  const tables = Object.fromEntries(checks)
  return {
    configured: true,
    reachable: checks.every(([, ok]) => ok),
    tables,
  }
}

/**
 * Read-only production gate. It intentionally returns only status booleans and
 * deployment identity; provider URLs, credentials, row data and upstream
 * payloads are never exposed.
 */
export async function checkSpatialProductionHealth(): Promise<SpatialProductionHealth> {
  const [provider, database] = await Promise.all([
    checkProvider(process.env.JHADINA_GEV_BASE_URL ?? process.env.GEV_BASE_URL),
    checkDatabase(),
  ])

  return {
    status: provider.configured && provider.reachable && database.configured && database.reachable
      ? 'READY'
      : 'DEGRADED',
    checkedAt: new Date().toISOString(),
    provider,
    database,
    deployment: {
      environment: process.env.VERCEL_ENV ?? null,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
  }
}
