import { GevProviderBridge } from '@jhadina/spatial-intelligence-core'
import { createRuntimeServiceRoleClient } from '../supabase/service-role'

export type SpatialProductionHealth = {
  status: 'READY' | 'DEGRADED'
  checkedAt: string
  provider: {
    configured: boolean
    reachable: boolean
    usable: boolean
    reportedSources: number
    healthySources: number
    fallbackSources: number
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

const ACTIVE_STATUSES = new Set(['ok', 'healthy', 'ready', 'online', 'active', 'up'])
const FALLBACK_KINDS = new Set(['streetview', 'fallback', 'simulated', 'synthetic', 'mock'])

async function checkProvider(baseUrl: string | undefined): Promise<SpatialProductionHealth['provider']> {
  const unavailable = { reachable: false, usable: false, reportedSources: 0, healthySources: 0, fallbackSources: 0 }
  if (!baseUrl?.trim()) return { configured: false, ...unavailable }
  try {
    const bridge = new GevProviderBridge({ baseUrl, timeoutMs: 3_000 })
    const sources = await bridge.cctvHealth('private-analysis')
    // A reachable endpoint with zero usable sources (or only fallback imagery)
    // must not certify a production GEV provider.
    const fallbackSources = sources.filter((source) => FALLBACK_KINDS.has(source.sourceKind.toLowerCase())).length
    const healthySources = sources.filter((source) =>
      ACTIVE_STATUSES.has(source.status.toLowerCase()) &&
      !FALLBACK_KINDS.has(source.sourceKind.toLowerCase()),
    ).length
    return {
      configured: true,
      reachable: true,
      usable: healthySources > 0,
      reportedSources: sources.length,
      healthySources,
      fallbackSources,
    }
  } catch {
    return { configured: true, ...unavailable }
  }
}

async function checkDatabase(): Promise<SpatialProductionHealth['database']> {
  // Use request-context OIDC when a static service-role secret is intentionally
  // absent from Vercel. A failed identity or gateway returns DEGRADED, not READY.
  const client = await createRuntimeServiceRoleClient().catch(() => null)
  if (!client) {
    return {
      configured: false,
      reachable: false,
      tables: Object.fromEntries(SPATIAL_TABLES.map((table) => [table, false])),
    }
  }
  const checks = await Promise.all(SPATIAL_TABLES.map(async (table) => {
    try {
      const { error } = await client.from(table).select('evidence_id', { head: true }).limit(0)
      // Not every Spatial table has an evidence_id. Use a schema-independent
      // count probe rather than selecting any named column.
      if (error) {
        const retry = await client.from(table).select('*', { count: 'exact', head: true })
        return [table, !retry.error] as const
      }
      return [table, true] as const
    } catch {
      return [table, false] as const
    }
  }))
  const tables = Object.fromEntries(checks)
  return {
    configured: true,
    reachable: checks.every(([, ok]) => ok),
    tables,
  }
}

/**
 * Read-only readiness: source usability and six-table database reachability.
 * This does NOT certify durable evidence, Reality admission, or Ask Jhadina;
 * those require separate same-deployment live acceptance receipts.
 * Never serialize credentials, upstream addresses or raw provider records.
 */
export async function checkSpatialProductionHealth(): Promise<SpatialProductionHealth> {
  const [provider, database] = await Promise.all([
    checkProvider(process.env.JHADINA_GEV_BASE_URL ?? process.env.GEV_BASE_URL),
    checkDatabase(),
  ])
  return {
    status: provider.configured && provider.reachable && provider.usable && database.configured && database.reachable
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
