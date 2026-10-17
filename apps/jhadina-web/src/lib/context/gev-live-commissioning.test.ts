import { describe, expect, it, vi } from 'vitest'
import { createBoundedGevFetch, readCommissionedGevSource, verifiedGevUpstreamOrigin } from './gev-live-commissioning'

const now = '2026-10-14T22:00:00.000Z'
const settings = {
  baseUrl: 'https://gev.example.org/',
  approvedHostname: 'gev.example.org',
  approvals: { camera: true, aircraft: true, vessel: true, fire: true },
}

const bridge = {
  cctvSources: vi.fn(async () => [{
    id: 'example-1', name: 'Public test camera', lat: 34, lon: -118, sourceKind: 'streetview',
  }]),
  cctvHealth: vi.fn(async () => []),
  openSky: vi.fn(async () => ({ time: 1792015200, states: [] })),
  aisLive: vi.fn(async () => ({ rows: [], status: 'unavailable' })),
  firms: vi.fn(async () => ({ fires: [] })),
}

describe('GEV-LIVE.04 commissioning protection', () => {
  it('requires HTTPS, exact host approval and no URL credentials or private IPs', () => {
    expect(verifiedGevUpstreamOrigin(settings)).toBe('https://gev.example.org')
    for (const url of [
      'http://gev.example.org', 'https://user:password@gev.example.org',
      'https://gev.example.org:444', 'https://gev.example.org/api/',
      'https://evil.example.org', 'https://127.0.0.1',
    ]) {
      expect(verifiedGevUpstreamOrigin({ ...settings, baseUrl: url })).toBeNull()
    }
  })

  it('does not call even an injected bridge without explicit rights approval', async () => {
    bridge.openSky.mockClear()
    const result = await readCommissionedGevSource('aircraft', 'private-analysis', now, {
      settings: { ...settings, approvals: { aircraft: false } }, bridge,
    })
    expect(result.status).toBe('UNAVAILABLE')
    expect(result.observedCount).toBe(0)
    expect(bridge.openSky).not.toHaveBeenCalled()
  })

  it('enforces source model-input policy before contacting approved cameras', async () => {
    bridge.cctvSources.mockClear()
    const result = await readCommissionedGevSource('camera', 'model-input', now, { settings, bridge })
    expect(result.status).toBe('DENIED')
    expect(bridge.cctvSources).not.toHaveBeenCalled()
  })

  it('keeps catalog or fallback camera observations non-admissible', async () => {
    const result = await readCommissionedGevSource('camera', 'private-analysis', now, { settings, bridge })
    expect(result.status).toBe('AVAILABLE')
    expect(result.observations).toHaveLength(1)
    expect(result.observations[0].attributes.realityAdmissionEligible).toBe(false)
    expect(result.observations[0].quality.freshness).toBe('unknown')
  })

  it('reports malformed commissioned payloads as unavailable', async () => {
    const result = await readCommissionedGevSource('fire', 'model-input', now, {
      settings, bridge: { ...bridge, firms: async () => ({ unexpected: 'token=MUST-NOT-LEAK' }) },
    })
    expect(result.status).toBe('UNAVAILABLE')
    expect(JSON.stringify(result)).not.toContain('MUST-NOT-LEAK')
  })

  it('blocks arbitrary proxy URLs and overlong upstream bodies', async () => {
    const fetcher = createBoundedGevFetch('https://gev.example.org', vi.fn(async () =>
      new Response(JSON.stringify({ rows: [], oversized: 'x'.repeat(550_000) }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })) as typeof fetch)
    await expect(fetcher('https://untrusted.example/api/ais-live')).rejects.toThrow('GEV_LIVE_TARGET_NOT_APPROVED')
    await expect(fetcher('https://gev.example.org/api/ais-live')).rejects.toThrow('GEV_LIVE_BODY_TOO_LARGE')
  })
})
