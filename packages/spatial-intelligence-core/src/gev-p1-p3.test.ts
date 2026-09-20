import test from 'node:test'
import assert from 'node:assert/strict'
import { GevProviderBridge, type GevFetchLike } from './gev-provider-bridge.js'
import { normalizeAisPayload, normalizeFirmsPayload, normalizeGevCctvSources, normalizeOpenSkyPayload, normalizeSatelliteRecord, normalizeUsgsEarthquakeGeoJson } from './gev-source-adapters.js'
import { createGevSourcePolicyRegistry } from './source-policy.js'

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body },
  async text() { return typeof body === 'string' ? body : JSON.stringify(body) },
})

test('GEV P1 source policy fails closed for restricted commercial use', () => {
  const registry = createGevSourcePolicyRegistry()
  assert.equal(registry.decide('gev-opensky', 'commercial-analysis').allowed, false)
  assert.equal(registry.decide('gev-firms', 'commercial-analysis').allowed, true)
  assert.equal(registry.require('gev-cctv').privacyClass, 'public-incidental-personal')
})

test('GEV P1 bridge uses only constructed same-origin API routes', async () => {
  const seen: string[] = []
  const fetchImpl: GevFetchLike = async (url) => {
    seen.push(url)
    return jsonResponse({ sources: [{ id: 'cam-1', lat: 30.2, lon: -97.7 }] })
  }
  const bridge = new GevProviderBridge({ baseUrl: 'https://gev.example/', fetchImpl })
  const sources = await bridge.cctvSources()
  assert.equal(sources.length, 1)
  assert.equal(seen[0], 'https://gev.example/api/cctv/sources')
})

test('GEV P1 bridge blocks restricted purpose before network access', async () => {
  let called = false
  const fetchImpl: GevFetchLike = async () => {
    called = true
    return jsonResponse({})
  }
  const bridge = new GevProviderBridge({ baseUrl: 'https://gev.example', fetchImpl })
  await assert.rejects(() => bridge.openSky({}, 'commercial-analysis'), /GEV_SOURCE_USE_NOT_ALLOWED/)
  assert.equal(called, false)
})

test('GEV P2 camera catalog normalizes as non-inferred spatial observations', () => {
  const observations = normalizeGevCctvSources([{ id: 'cam-1', lat: 30.2, lon: -97.7, provider: 'Austin', sourceKind: 'austin-live', feedType: 'image' }], '2026-09-19T20:00:00Z')
  assert.equal(observations[0].entity.type, 'camera')
  assert.equal(observations[0].inference, false)
  assert.equal(observations[0].attributes.sourceKind, 'austin-live')
})

test('GEV P2 OpenSky adapter preserves source identity and state timing', () => {
  const payload = { time: 1_758_312_000, states: [['abc123', 'TEST1 ', 'United States', null, 1_758_311_990, -117.2, 33.9, 1000, false, 120, 90, 0, null, 1000, '1200', false, 0, 3]] }
  const observations = normalizeOpenSkyPayload(payload, '2026-09-19T20:00:00Z')
  assert.equal(observations.length, 1)
  assert.equal(observations[0].entity.type, 'aircraft')
  assert.equal(observations[0].attributes.callsign, 'TEST1')
  assert.equal(observations[0].source.provider, 'OpenSky Network')
})

test('GEV P2 AIS and FIRMS stay separate source observations', () => {
  const ais = normalizeAisPayload({ source: 'AISStream', status: 'live', rows: [{ mmsi: '123456789', lat: 33.8, lon: -118.2, timestamp: '2026-09-19T19:59:00Z' }] }, '2026-09-19T20:00:00Z')
  const fires = normalizeFirmsPayload({ stale: false, fires: [{ latitude: 34.1, longitude: -117.4, acq_date: '2026-09-19', acq_time: '1955', satellite: 'NOAA-20' }] }, '2026-09-19T20:00:00Z')
  assert.equal(ais[0].entity.type, 'vessel')
  assert.equal(fires[0].entity.type, 'fire')
  assert.notEqual(ais[0].provenance.source_ref, fires[0].provenance.source_ref)
})

test('GEV P2 USGS and satellite adapters do not invent missing positions', () => {
  const quakes = normalizeUsgsEarthquakeGeoJson({ features: [{ id: 'q1', properties: { mag: 3.2, time: 1_758_312_000_000 }, geometry: { coordinates: [-117.2, 34.1, 8.5] } }] }, '2026-09-19T20:00:00Z')
  const satellite = normalizeSatelliteRecord({ id: '25544', name: 'ISS' }, '2026-09-19T20:00:00Z')
  assert.equal(quakes[0].position?.altitude_m, 8500)
  assert.equal(satellite.position, null)
  assert.equal(satellite.quality.completeness, 'unknown')
})
