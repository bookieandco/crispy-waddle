import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CctvCameraCatalogClient,
  cctvCatalogProfileToObservation,
  type CctvCatalogFetchLike,
} from './cctv-camera-catalog.js'
import { createGevSourcePolicyRegistry } from './source-policy.js'

const payloads: Record<string, unknown> = {
  '/api/brands.json': {
    brands: [
      { name: 'Reolink', slug: 'reolink', count: 2 },
      { name: 'Dahua', slug: 'dahua', count: 2 },
    ],
  },
  '/api/brands/reolink.json': {
    name: 'Reolink',
    slug: 'reolink',
    cameras: [
      { id: 'reolink-rlc-823a', model: 'RLC-823A', type: 'ptz', resolution: '4K' },
      { id: 'reolink-e1-pro', model: 'E1 Pro', type: 'ptz', resolution: '4MP' },
    ],
  },
  '/api/cameras/reolink-rlc-823a.json': {
    id: 'reolink-rlc-823a',
    brand: 'Reolink',
    model: 'RLC-823A',
    type: 'ptz',
    resolution: { megapixels: 8, label: '4K UHD' },
    protocols: ['ONVIF', 'RTSP'],
    connectivity: ['ethernet'],
    power_source: ['poe'],
    power: { method: 'PoE' },
    ip_rating: 'IP66',
    night_vision: { type: 'ir', range_m: 60 },
    audio: { two_way: true },
    features: ['auto tracking', 'person detection'],
    sources: ['https://reolink.com/product/rlc-823a/'],
    last_verified: '2026-09-22',
    configs: { frigate: { verified: true } },
  },
}

const fakeFetch: CctvCatalogFetchLike = async (url) => {
  const parsed = new URL(url)
  const payload = payloads[parsed.pathname]
  return {
    ok: payload !== undefined,
    status: payload === undefined ? 404 : 200,
    async json() { return payload ?? {} },
  }
}

test('CCTV Database policy is separate from live GEV CCTV and permits catalog model input', () => {
  const registry = createGevSourcePolicyRegistry()
  const catalog = registry.require('cctv-database-catalog')
  const live = registry.require('gev-cctv')

  assert.equal(catalog.privacyClass, 'public-non-personal')
  assert.equal(registry.decide('cctv-database-catalog', 'model-input').allowed, true)
  assert.equal(registry.decide('gev-cctv', 'model-input').allowed, false)
  assert.notEqual(catalog.sourceIndependenceKey, live.sourceIndependenceKey)
})

test('CCTV Database client resolves an exact brand/model without broad live-camera discovery', async () => {
  const calls: string[] = []
  const client = new CctvCameraCatalogClient({
    fetchImpl: async (url, init) => {
      calls.push(new URL(url).pathname)
      return fakeFetch(url, init)
    },
  })

  const results = await client.searchCameraProfiles(
    'What can the Reolink RLC-823A camera do?',
    'model-input',
  )

  assert.equal(results.length, 1)
  assert.equal(results[0].brand, 'Reolink')
  assert.equal(results[0].model, 'RLC-823A')
  assert.deepEqual(results[0].protocols, ['ONVIF', 'RTSP'])
  assert.equal(results[0].frigateVerified, true)
  assert.deepEqual(calls, [
    '/api/brands.json',
    '/api/brands/reolink.json',
    '/api/cameras/reolink-rlc-823a.json',
  ])
})

test('catalog enrichment does not invent a camera when only the brand is named', async () => {
  const client = new CctvCameraCatalogClient({ fetchImpl: fakeFetch })
  const results = await client.searchCameraProfiles('Show me Reolink cameras near LAX', 'model-input')
  assert.deepEqual(results, [])
})

test('catalog observation is capability metadata, not location or live-feed evidence', () => {
  const observation = cctvCatalogProfileToObservation({
    id: 'reolink-rlc-823a',
    brand: 'Reolink',
    model: 'RLC-823A',
    type: 'ptz',
    resolutionLabel: '4K UHD',
    megapixels: 8,
    protocols: ['ONVIF', 'RTSP'],
    connectivity: ['ethernet'],
    powerSource: ['poe'],
    powerMethod: 'PoE',
    ipRating: 'IP66',
    ikRating: null,
    nightVisionType: 'ir',
    nightVisionRangeM: 60,
    twoWayAudio: true,
    features: ['auto tracking'],
    sourceUrls: ['https://reolink.com/product/rlc-823a/'],
    lastVerified: '2026-09-22',
    frigateVerified: true,
  }, '2026-09-23T20:00:00Z')

  assert.equal(observation.position, null)
  assert.equal(observation.observed_at, null)
  assert.equal(observation.attributes.liveDeploymentEvidence, false)
  assert.equal(observation.attributes.liveFeedEvidence, false)
  assert.equal(observation.provenance.source_ref, 'cctv-database-catalog')
})
