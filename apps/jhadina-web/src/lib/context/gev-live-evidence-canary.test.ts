import { describe, expect, it, vi } from 'vitest'
import {
  InMemorySpatialEvidenceStore,
  InMemorySpatialRealityStore,
  normalizeUsgsEarthquakeGeoJson,
  type SpatialEvidenceStore,
} from '@jhadina/spatial-intelligence-core'
import { runGevLiveEvidenceCanary, type GevLiveCanaryReceipt } from './gev-live-evidence-canary'
import type { GatewaySnapshot } from './gev-live-source-gateway'

const at = '2026-10-14T22:00:00.000Z'
const buildSource = (eventAt = '2026-10-14T21:55:00.000Z'): GatewaySnapshot => {
  const observations = normalizeUsgsEarthquakeGeoJson({
    features: [{
      type: 'Feature', id: 'us-canary-1',
      geometry: { type: 'Point', coordinates: [-118.3, 34.2, 8] },
      properties: { time: Date.parse(eventAt), mag: 2.5, place: 'Test fixture - not a live claim' },
    }],
  }, at)
  return {
    kind: 'GEV_SOURCE_GATEWAY_V1', checkedAt: at, authority: 'INTELLIGENCE_ONLY',
    persisted: false, admittedReality: false,
    sources: [{
      domain: 'earthquake', sourceId: 'gev-usgs', status: 'AVAILABLE',
      observedCount: observations.length, observations, attribution: 'USGS',
      termsRef: 'USGS data source policy', limitations: [],
    }],
  }
}

const run = (overrides: Parameters<typeof runGevLiveEvidenceCanary>[0] = {}) =>
  runGevLiveEvidenceCanary({
    now: () => at, enabled: true, checkPrivilegedTables: async () => true,
    query: async () => buildSource(),
    evidenceStore: new InMemorySpatialEvidenceStore(),
    realityStore: new InMemorySpatialRealityStore(),
    ...overrides,
  })

const notSuccess = (receipt: GevLiveCanaryReceipt) => {
  expect(receipt.status).not.toBe('VERIFIED')
  expect(receipt.admittedReality).toBe(false)
}

describe('GEV-LIVE.05–.07 manual durable evidence receipt', () => {
  it('stays disabled without explicit enablement and makes no upstream calls', async () => {
    const query = vi.fn(async () => buildSource())
    const receipt = await run({ enabled: false, query })
    expect(receipt.status).toBe('DISABLED')
    expect(query).not.toHaveBeenCalled()
  })

  it('rejects an unavailable privileged six-table identity before sourcing', async () => {
    const query = vi.fn(async () => buildSource())
    const receipt = await run({ checkPrivilegedTables: async () => false, query })
    expect(receipt.status).toBe('IDENTITY_UNAVAILABLE')
    expect(query).not.toHaveBeenCalled()
  })

  it('verifies canonical USGS evidence hash and candidate/admission readback', async () => {
    const evidenceStore = new InMemorySpatialEvidenceStore()
    const realityStore = new InMemorySpatialRealityStore()
    const receipt = await run({ evidenceStore, realityStore })
    expect(receipt.status).toBe('VERIFIED')
    expect(receipt.checks).toEqual({
      databaseTables: 6, evidenceReadback: true, candidateReadback: true, admissionReadback: true,
    })
    expect(receipt.decision).toBe('ACCEPT')
    expect(receipt.durabilityVerified).toBe(true)
    expect(receipt.admittedReality).toBe(true)
    expect(receipt.evidenceHash).toMatch(/^[a-f0-9]{64}$/)
    expect((await evidenceStore.get(receipt.evidenceId!))?.integrity.contentHash).toBe(receipt.evidenceHash)
    expect(await realityStore.getCandidate(receipt.candidateId!)).toBeDefined()
    expect((await realityStore.getAdmissions(receipt.candidateId!)).some(x => x.admissionId === receipt.admissionId)).toBe(true)
  })

  it('defers a stale observation without writing canonical evidence', async () => {
    const append = vi.fn()
    const store = { append, get: vi.fn() } as unknown as SpatialEvidenceStore
    const receipt = await run({ evidenceStore: store, query: async () => buildSource('2026-10-12T20:00:00Z') })
    expect(receipt.status).toBe('DEFERRED')
    expect(receipt.reasonCode).toBe('NO_RECENT_NON_DERIVED_OBSERVATION')
    expect(append).not.toHaveBeenCalled()
    notSuccess(receipt)
  })

  it('fails closed when stored content is tampered or readback missing', async () => {
    const real = new InMemorySpatialEvidenceStore()
    const tampered: SpatialEvidenceStore = {
      append: (evidence) => real.append(evidence),
      get: async (id) => {
        const evidence = await real.get(id)
        if (!evidence) return undefined
        return { ...evidence, payload: { ...evidence.payload, attributes: { replaced: true } } }
      },
    }
    const receipt = await run({ evidenceStore: tampered })
    expect(receipt.status).toBe('EVIDENCE_FAILED_CLOSED')
    expect(receipt.checks.candidateReadback).toBe(false)
    notSuccess(receipt)
  })

  it('does not leak storage exceptions into a public receipt', async () => {
    const receipt = await run({
      evidenceStore: {
        append: async () => { throw Error('SUPABASE_SERVICE_ROLE_KEY=never-leak') },
        get: async () => undefined,
      },
    })
    expect(receipt.status).toBe('EVIDENCE_FAILED_CLOSED')
    expect(JSON.stringify(receipt)).not.toContain('never-leak')
    notSuccess(receipt)
  })

  it('rejects synthetic or unavailable source reports without persisting them', async () => {
    const unavailable = buildSource()
    unavailable.sources[0].status = 'UNAVAILABLE'
    const result = await run({ query: async () => unavailable })
    expect(result.status).toBe('SOURCE_UNAVAILABLE')
    notSuccess(result)
  })
})
