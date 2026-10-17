import { describe, expect, it, vi } from 'vitest'
import { normalizeUsgsEarthquakeGeoJson, normalizeSatelliteRecord } from '@jhadina/spatial-intelligence-core'
import type { GatewaySnapshot } from './gev-live-source-gateway'
import { readGevPublicReadiness } from './gev-cert-public-readiness'

const at = '2026-10-16T23:00:00.000Z'
const quake = normalizeUsgsEarthquakeGeoJson({
  features: [{
    type: 'Feature', id: 'us-test',
    geometry: { type: 'Point', coordinates: [-118, 34, 8] },
    properties: { time: Date.parse('2026-10-16T22:50:00Z'), mag: 2.4, place: 'Test' },
  }],
}, at)[0]
const satellite = normalizeSatelliteRecord({ id: '25544', name: 'ISS', observedAt: at }, at)

const snapshot = (): GatewaySnapshot => ({
  kind: 'GEV_SOURCE_GATEWAY_V1', checkedAt: at, authority: 'INTELLIGENCE_ONLY',
  persisted: false, admittedReality: false,
  sources: [{
    domain: 'earthquake', sourceId: 'gev-usgs', status: 'AVAILABLE',
    observedCount: 1, observations: [quake], attribution: 'USGS',
    termsRef: 'USGS', limitations: [],
  }, {
    domain: 'satellite', sourceId: 'gev-celestrak', status: 'AVAILABLE',
    observedCount: 1, observations: [satellite], attribution: 'CelesTrak',
    termsRef: 'CelesTrak', limitations: [],
  }],
})
const probe = (fixture: GatewaySnapshot) => readGevPublicReadiness({
  now: () => at,
  read: async () => fixture,
})

describe('GEV-CERT.03 public-source independence', () => {
  it('reads USGS/CelesTrak as observation-only without any CCTV, funding, Supabase or Reality dependency', async () => {
    const read = vi.fn(async () => snapshot())
    const receipt = await readGevPublicReadiness({ now: () => at, read })
    expect(read).toHaveBeenCalledWith({ purpose: 'model-input', domains: ['earthquake', 'satellite'] })
    expect(receipt.status).toBe('SOURCE_READABLE')
    expect(receipt.sources.map(s => s.state)).toEqual(['OBSERVED', 'OBSERVED'])
    expect(receipt.sources[1].derivedEstimate).toBe(true)
    expect(receipt.scope).toBe('READ_ONLY_PUBLIC_SOURCE')
    expect(receipt.productionCertified).toBe(false)
    expect(receipt.persisted).toBe(false)
    expect(receipt.admittedReality).toBe(false)
    expect(receipt.canAct).toBe(false)
  })
  it('counts an empty but structurally valid feed as readable, never as observed data', async () => {
    const fixture = snapshot()
    fixture.sources[0].observations = []
    fixture.sources[0].observedCount = 0
    const report = await probe(fixture)
    expect(report.sources[0].state).toBe('EMPTY')
    expect(report.sources[0].sampleCount).toBe(0)
    expect(report.status).toBe('SOURCE_READABLE')
  })
  it('independently reports partial status if CelesTrak cannot be verified', async () => {
    const fixture = snapshot()
    fixture.sources[1].status = 'UNAVAILABLE'
    fixture.sources[1].observations = []
    fixture.sources[1].observedCount = 0
    const report = await probe(fixture)
    expect(report.status).toBe('PARTIAL')
    expect(report.blockers).toEqual(['CELESTRAK_SOURCE_UNAVAILABLE'])
    expect(report.sources[0].state).toBe('OBSERVED')
  })
  it('rejects mismatched source, synthetic USGS and falsely admitted snapshots', async () => {
    const fixture = snapshot()
    fixture.sources[0].observations[0] = {
      ...quake,
      provenance: { ...quake.provenance, source_ref: 'wrong-provider' },
    }
    expect((await probe(fixture)).sources[0].state).toBe('UNAVAILABLE')
    fixture.sources[0].observations[0] = { ...quake, inference: true }
    expect((await probe(fixture)).sources[0].state).toBe('UNAVAILABLE')
    fixture.sources[0].observations = [quake]
    fixture.admittedReality = true as false
    expect((await probe(fixture)).status).toBe('UNAVAILABLE')
  })
  it('rejects stale checking timestamps and malformed counts without leaking any source payload', async () => {
    const fixture = snapshot()
    fixture.checkedAt = '2026-10-01T00:00:00.000Z'
    expect((await probe(fixture)).status).toBe('UNAVAILABLE')
    fixture.checkedAt = at
    fixture.sources[0].observedCount = -1
    expect((await probe(fixture)).sources[0].state).toBe('UNAVAILABLE')
  })
  it('fails closed and scrubs upstream exceptions', async () => {
    const report = await readGevPublicReadiness({
      now: () => at,
      read: async () => { throw new Error('PRIVATE_UPSTREAM_AUTH_TOKEN=abc') },
    })
    expect(report.status).toBe('UNAVAILABLE')
    expect(JSON.stringify(report)).not.toContain('PRIVATE_UPSTREAM_AUTH_TOKEN')
  })
})
