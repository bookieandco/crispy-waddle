import { GevProviderBridge } from '@jhadina/spatial-intelligence-core'
import { createRuntimeServiceRoleClient } from '../supabase/service-role'
import { createBoundedGevFetch, getGevLiveCommissioningSettings, verifiedGevUpstreamOrigin } from './gev-live-commissioning'

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

async function checkProvider(): Promise<SpatialProductionHealth['provider']> {
  const unavailable = { reachable: false, usable: false, reportedSources: 0, healthySources: 0, fallbackSources: 0 }
  const settings = getGevLiveCommissioningSettings()
  const origin = verifiedGevUpstreamOrigin(settings)
  if (!origin || settings.approvals.camera !== true) return { configured: false, ...unavailable }
  try {
    const bridge = new GevProviderBridge({ baseUrl: origin, timeoutMs: 3_000, fetchImpl: createBoundedGevFetch(origin) })
    const sources = await bridge.cctvHealth('private-analysis')
    // Camera health is a demand-populated map upstream; an empty map on
    // cold start is not evidence of an unavailable backend. Report observed
    // healthy camera counts separately from provider transport reachability.
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
      const { error } = await client.from(table).select('*', { head: true, count: 'exact' })
      return [table, !error] as const
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
 * Read-only infrastructure readiness: GEV HTTP response and six-table database reachability.
 * Camera-source usability is separate, because the upstream camera health map
 * is cold until requests are served. READY is NOT a source-data certification.
 * This does NOT certify durable evidence, Reality admission, or Ask Jhadina;
 * those require separate same-deployment live acceptance receipts.
 * Never serialize credentials, upstream addresses or raw provider records.
 */
export async function checkSpatialProductionHealth(): Promise<SpatialProductionHealth> {
  const [provider, database] = await Promise.all([
    checkProvider(),
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
