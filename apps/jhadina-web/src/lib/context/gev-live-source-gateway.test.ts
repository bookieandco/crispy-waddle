import { describe, expect, it, vi } from 'vitest'
import { normalizeSatelliteRecord } from '@jhadina/spatial-intelligence-core'
import { parseGatewayInput, readGevLiveSourceGateway } from './gev-live-source-gateway'

const at = '2026-10-14T22:00:00.000Z'
const sampleEvent = {
  id: 'us-test-1',
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-118.2, 34.1, 7] },
  properties: { time: Date.parse('2026-10-14T21:50:00Z'), mag: 3.1, place: 'test area' },
}
const jsonResponse = (value: unknown, contentType = 'application/geo+json') =>
  new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': contentType } })

describe('GEV-LIVE.02–.03 canonical governed source gateway', () => {
  it('normalizes a bounded real-schema USGS event with source, time and location', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')
      expect(init?.method).toBe('GET')
      expect(init?.redirect).toBe('error')
      return jsonResponse({ type: 'FeatureCollection', features: [sampleEvent] })
    })
    const snapshot = await readGevLiveSourceGateway(
      { purpose: 'model-input', domains: ['earthquake'] },
      { fetchImpl: fetcher as typeof fetch, now: () => at },
    )
    expect(snapshot.authority).toBe('INTELLIGENCE_ONLY')
    expect(snapshot.persisted).toBe(false)
    expect(snapshot.admittedReality).toBe(false)
    expect(snapshot.sources[0]).toMatchObject({ status: 'AVAILABLE', sourceId: 'gev-usgs', observedCount: 1 })
    expect(snapshot.sources[0].observations[0]).toMatchObject({
      source: { provider: 'USGS', record_id: 'us-test-1' },
      provenance: { source_ref: 'gev-usgs', adapter_version: 'gev-source-adapters:v1' },
      position: { lat: 34.1, lon: -118.2 },
      observed_at: '2026-10-14T21:50:00.000Z',
      received_at: at,
      inference: false,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('denies restricted sources before a network call; uncommissioned allowed domains remain unavailable', async () => {
    const fetcher = vi.fn()
    const snapshot = await readGevLiveSourceGateway(
      { purpose: 'model-input', domains: ['camera', 'aircraft', 'vessel', 'fire'] },
      { fetchImpl: fetcher as typeof fetch, now: () => at },
    )
    expect(snapshot.sources.map(x => x.status)).toEqual(['DENIED', 'DENIED', 'DENIED', 'UNAVAILABLE'])
    expect(snapshot.sources.every(x => x.observations.length === 0)).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('reports absent camera, aircraft, vessel and fire providers in private analysis without fabricating observations', async () => {
    const snapshot = await readGevLiveSourceGateway(
      { purpose: 'private-analysis', domains: ['camera', 'aircraft', 'vessel', 'fire'] },
      { now: () => at },
    )
    expect(snapshot.sources.map(x => x.status)).toEqual(['UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE'])
  })

  it('rejects malformed and oversized upstream payloads without leaking bodies', async () => {
    // Never clone an unread streaming response: a tee branch can make cancel()
    // wait for the other clone indefinitely in this bounded-stream regression.
    for (const buildResponse of [
      () => jsonResponse({ untrusted: 'NOT_USGS' }),
      () => jsonResponse({ type: 'FeatureCollection', features: [] }, 'text/html'),
      () => jsonResponse({ type: 'FeatureCollection', features: [], junk: 'x'.repeat(790_000) }),
    ]) {
      const snapshot = await readGevLiveSourceGateway(
        { purpose: 'model-input', domains: ['earthquake'] },
        { fetchImpl: vi.fn(async () => buildResponse()) as typeof fetch, now: () => at },
      )
      expect(snapshot.sources[0].status).toBe('UNAVAILABLE')
      expect(snapshot.sources[0].observations).toHaveLength(0)
      expect(JSON.stringify(snapshot)).not.toContain('NOT_USGS')
      expect(JSON.stringify(snapshot)).not.toContain('790000')
    }
  })

  it('bounds data returned from an otherwise valid high-volume USGS feed', async () => {
    const many = Array.from({ length: 50 }, (_, index) => ({ ...sampleEvent, id: 'us-test-' + index }))
    const snapshot = await readGevLiveSourceGateway(
      { purpose: 'model-input', domains: ['earthquake'] },
      { fetchImpl: vi.fn(async () => jsonResponse({ type: 'FeatureCollection', features: many })) as typeof fetch, now: () => at },
    )
    expect(snapshot.sources[0].observations).toHaveLength(24)
    expect(snapshot.sources[0].limitations.join(' ')).toContain('bounded')
  })

  it('reuses a governed satellite reader and keeps derived positions non-authoritative', async () => {
    const read = vi.fn(async () => ({
      observations: [normalizeSatelliteRecord({ id: '25544', name: 'ISS', observedAt: at }, at)],
      sourceHealth: ['satellite:celestrak:available:1:group=stations'],
      limitations: [],
    }))
    const snapshot = await readGevLiveSourceGateway(
      { purpose: 'model-input', domains: ['satellite'] },
      { satellite: { read }, now: () => at },
    )
    expect(snapshot.sources[0]).toMatchObject({ status: 'AVAILABLE', sourceId: 'gev-celestrak', observedCount: 1 })
    expect(snapshot.sources[0].observations[0].position).toBeNull()
    expect(snapshot.sources[0].limitations.join(' ')).toContain('not operational ground truth')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('fails closed on absent satellite data and sanitizes upstream errors', async () => {
    const snapshot = await readGevLiveSourceGateway(
      { purpose: 'model-input', domains: ['satellite'] },
      { satellite: { read: async () => { throw Error('private-token-leak') } }, now: () => at },
    )
    expect(snapshot.sources[0].status).toBe('UNAVAILABLE')
    expect(JSON.stringify(snapshot)).not.toContain('private-token-leak')
  })

  it('rejects unknown domains, empty selections and arbitrary purposes', () => {
    expect(() => parseGatewayInput({ domains: ['surveillance'], purpose: 'model-input' })).toThrow('GEV_GATEWAY_DOMAINS_INVALID')
    expect(() => parseGatewayInput({ domains: [], purpose: 'model-input' })).toThrow('GEV_GATEWAY_DOMAINS_INVALID')
    expect(() => parseGatewayInput({ domains: ['earthquake'], purpose: 'publication' })).toThrow('GEV_GATEWAY_PURPOSE_INVALID')
  })

  it('deduplicates bounded domain requests', () => {
    expect(parseGatewayInput({ domains: ['earthquake', 'earthquake'], purpose: 'private-analysis' }))
      .toEqual({ purpose: 'private-analysis', domains: ['earthquake'] })
  })
})
