import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  cameras: [] as Array<{ id: string; status: string; sourceKind: string }>,
  providerFails: false,
  dbAvailable: false,
  dbFailTable: '' as string,
  dbFailure: false,
}))

vi.mock('@jhadina/spatial-intelligence-core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@jhadina/spatial-intelligence-core')>(),
  GevProviderBridge: class {
    async cctvHealth() {
      if (fixture.providerFails) throw new Error('provider-unavailable-sensitive-details')
      return fixture.cameras
    }
  },
}))

vi.mock('../supabase/service-role', () => ({
  createRuntimeServiceRoleClient: vi.fn(async () => {
    if (fixture.dbFailure) throw new Error('database-identity-failed')
    if (!fixture.dbAvailable) return null
    return {
      from: (table: string) => ({
        select: async () => ({ error: table === fixture.dbFailTable ? { code: 'PGRST116' } : null }),
      }),
    }
  }),
}))

import { checkSpatialProductionHealth } from './spatial-production-health'

const env = ['JHADINA_GEV_BASE_URL', 'GEV_BASE_URL', 'JHADINA_GEV_APPROVED_HOSTNAME', 'JHADINA_GEV_APPROVE_CAMERA', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_SHA'] as const
const snapshot = new Map<string, string | undefined>()
beforeEach(() => {
  for (const key of env) { snapshot.set(key, process.env[key]); delete process.env[key] }
  fixture.cameras = []
  fixture.providerFails = false
  fixture.dbAvailable = false
  fixture.dbFailTable = ''
  fixture.dbFailure = false
})
afterEach(() => {
  for (const key of env) {
    const value = snapshot.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  snapshot.clear()
})

describe('GEV production infrastructure readiness', () => {
  it('fails closed when both providers are absent', async () => {
    const result = await checkSpatialProductionHealth()
    expect(result.status).toBe('DEGRADED')
    expect(result.provider.configured).toBe(false)
    expect(result.provider.reachable).toBe(false)
    expect(result.database.configured).toBe(false)
    expect(Object.values(result.database.tables)).toHaveLength(6)
    expect(Object.values(result.database.tables).every((value) => value === false)).toBe(true)
  })

  it('does not contact an unapproved hostname even when a legacy base URL exists', async () => {
    process.env.GEV_BASE_URL = 'https://unapproved.example.test'
    fixture.dbAvailable = true
    const result = await checkSpatialProductionHealth()
    expect(result.status).toBe('DEGRADED')
    expect(result.provider.configured).toBe(false)
    expect(result.provider.reachable).toBe(false)
    expect(JSON.stringify(result)).not.toContain('unapproved.example.test')
  })

  it('does not mistake an empty cold-start camera map for unreachable GEV', async () => {
    process.env.JHADINA_GEV_BASE_URL = 'https://gev.example.test'
    process.env.JHADINA_GEV_APPROVED_HOSTNAME = 'gev.example.test'
    process.env.JHADINA_GEV_APPROVE_CAMERA = 'true'
    fixture.dbAvailable = true
    const result = await checkSpatialProductionHealth()
    expect(result.status).toBe('READY')
    expect(result.provider).toEqual({
      configured: true, reachable: true, usable: false, reportedSources: 0, healthySources: 0, fallbackSources: 0,
    })
    expect(Object.values(result.database.tables).every(Boolean)).toBe(true)
  })

  it('reports fallback-only cameras without claiming a verified live camera', async () => {
    process.env.GEV_BASE_URL = 'https://gev.example.test'
    process.env.JHADINA_GEV_APPROVED_HOSTNAME = 'gev.example.test'
    process.env.JHADINA_GEV_APPROVE_CAMERA = 'true'
    fixture.dbAvailable = true
    fixture.cameras = [{ id: 'cam-1', status: 'degraded', sourceKind: 'streetview' }]
    const result = await checkSpatialProductionHealth()
    expect(result.status).toBe('READY')
    expect(result.provider.fallbackSources).toBe(1)
    expect(result.provider.healthySources).toBe(0)
    expect(result.provider.usable).toBe(false)
  })

  it('separately reports a live-source indication without making an E2E claim', async () => {
    process.env.GEV_BASE_URL = 'https://gev.example.test'
    fixture.dbAvailable = true
    fixture.cameras = [{ id: 'cam-1', status: 'healthy', sourceKind: 'configured' }]
    const result = await checkSpatialProductionHealth()
    expect(result.status).toBe('READY')
    expect(result.provider.usable).toBe(true)
    expect(result.provider.healthySources).toBe(1)
    expect(JSON.stringify(result)).not.toContain('gev.example.test')
  })

  it('degrades on provider failure and redacts upstream errors', async () => {
    process.env.GEV_BASE_URL = 'https://gev.example.test'
    fixture.dbAvailable = true
    fixture.providerFails = true
    const result = await checkSpatialProductionHealth()
    expect(result.status).toBe('DEGRADED')
    expect(result.provider.reachable).toBe(false)
    expect(JSON.stringify(result)).not.toContain('provider-unavailable-sensitive-details')
  })

  it('degrades on partial table failure with six per-table checks', async () => {
    process.env.GEV_BASE_URL = 'https://gev.example.test'
    fixture.dbAvailable = true
    fixture.dbFailTable = 'jhadina_knowledge_relations'
    const result = await checkSpatialProductionHealth()
    expect(result.status).toBe('DEGRADED')
    expect(result.database.tables.jhadina_knowledge_relations).toBe(false)
    expect(Object.values(result.database.tables).filter(Boolean)).toHaveLength(5)
  })

  it('degrades when privilege resolution fails without leaking errors', async () => {
    process.env.GEV_BASE_URL = 'https://gev.example.test'
    fixture.dbFailure = true
    const result = await checkSpatialProductionHealth()
    expect(result.status).toBe('DEGRADED')
    expect(result.database.configured).toBe(false)
    expect(JSON.stringify(result)).not.toContain('database-identity-failed')
  })
})
