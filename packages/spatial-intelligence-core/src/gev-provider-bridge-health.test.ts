import { describe, expect, it } from 'vitest'
import { GevProviderBridge } from './gev-provider-bridge.js'

const makeBridge = (payload: unknown) => new GevProviderBridge({
  baseUrl: 'https://test-gev.example',
  fetchImpl: async (url, init) => {
    expect(new URL(url).pathname).toBe('/api/cctv/health')
    expect(init?.method).toBe('GET')
    return { ok: true, status: 200, json: async () => payload, text: async () => '' }
  },
})

describe('GEV cold-start and malformed camera health', () => {
  it('accepts a valid empty cold-start health envelope', async () => {
    await expect(makeBridge({ cameras: [] }).cctvHealth()).resolves.toEqual([])
  })

  it('accepts valid per-camera provenance and fallback metadata', async () => {
    const row = { id: 'camera-1', status: 'degraded', sourceKind: 'streetview', updatedAt: 12345 }
    await expect(makeBridge({ cameras: [row] }).cctvHealth()).resolves.toEqual([row])
  })

  it('rejects HTTP 200 with a malformed JSON body', async () => {
    await expect(makeBridge({ error: 'upstream gateway HTML / unsupported shape' }).cctvHealth())
      .rejects.toThrow('GEV_CCTV_HEALTH_PAYLOAD_INVALID')
  })
})
