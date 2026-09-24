import test from 'node:test'
import assert from 'node:assert/strict'
import { createPublicSatelliteSpatialProvider, propagateOmmContext, type SatelliteFetchLike } from './public-satellite-provider.js'
import { planSpatialQuery } from './spatial-pipeline.js'
import { createGevSpatialContextReadProvider } from './gev-spatial-context-read-provider.js'
import { InMemorySpatialEvidenceStore } from './evidence-store.js'
import { InMemorySpatialRealityStore } from './reality.js'
import { createSpatialRealityAdmissionReadProvider } from './spatial-reality-admission-read-provider.js'

const omm = [{
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2026-09-23T12:00:00.000000',
  MEAN_MOTION: 15.49,
  ECCENTRICITY: 0.0006,
  INCLINATION: 51.64,
  RA_OF_ASC_NODE: 120.5,
  ARG_OF_PERICENTER: 81.2,
  MEAN_ANOMALY: 42.3,
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 50000,
}]

function fakeFetch(counter: { celestrak: number; gibs: number }): SatelliteFetchLike {
  return async (url) => {
    const parsed = new URL(url)
    if (parsed.hostname === 'celestrak.org') {
      counter.celestrak += 1
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        async json() { return omm },
        async arrayBuffer() { return new ArrayBuffer(0) },
      }
    }
    if (parsed.hostname === 'gibs.earthdata.nasa.gov') {
      counter.gibs += 1
      const bytes = new Uint8Array(256)
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 251
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : null },
        async json() { return {} },
        async arrayBuffer() { return bytes.buffer },
      }
    }
    throw new Error('unexpected host')
  }
}

const imageryPlan = () => planSpatialQuery({
  queryId: 'satellite-lax',
  kind: 'OBSERVE',
  subject: 'show me satellite imagery near LAX',
  geographicScope: { lat: 33.942501, lon: -118.407997, radiusKm: 25 },
  temporalScope: { from: null, to: null, asOf: null },
  requestedDomains: ['satellite'],
  requiresEvidence: true,
})

test('satellite provider fetches OMM JSON and NASA GIBS imagery with bounded provenance', async () => {
  const counter = { celestrak: 0, gibs: 0 }
  const provider = createPublicSatelliteSpatialProvider({
    fetchImpl: fakeFetch(counter),
    now: () => '2026-09-24T04:00:00.000Z',
  })

  const result = await provider.read(imageryPlan(), 'model-input', '2026-09-24T04:00:00.000Z')
  assert.equal(counter.celestrak, 1)
  assert.equal(counter.gibs, 1)
  assert.ok(result.observations.some((row) => row.observation_type === 'satellite_orbit_elements'))
  assert.ok(result.observations.some((row) => row.observation_type === 'satellite_imagery_asset'))

  const orbit = result.observations.find((row) => row.observation_type === 'satellite_orbit_elements')!
  assert.equal(orbit.position, null)
  assert.equal(orbit.attributes.realityAdmissionEligible, false)
  assert.equal((orbit.attributes.derivedSubpoint as Record<string, unknown>).model, 'kepler-two-body-context-v1')

  const image = result.observations.find((row) => row.observation_type === 'satellite_imagery_asset')!
  assert.equal(image.position, null)
  assert.equal(image.attributes.realityAdmissionEligible, false)
  assert.equal(image.attributes.contentType, 'image/jpeg')
  assert.equal(image.attributes.byteLength, 256)
  assert.match(String(image.attributes.assetUrl), /^https:\/\/gibs\.earthdata\.nasa\.gov\//)
  assert.equal(String(image.attributes.sha256).length, 64)
})

test('CelesTrak results are cached for at least the provider update interval', async () => {
  const counter = { celestrak: 0, gibs: 0 }
  const provider = createPublicSatelliteSpatialProvider({
    fetchImpl: fakeFetch(counter),
    now: () => '2026-09-24T04:00:00.000Z',
  })
  const plan = planSpatialQuery({
    queryId: 'satellite-iss',
    kind: 'LOCATE',
    subject: 'where is the ISS',
    geographicScope: { lat: 33.942501, lon: -118.407997, radiusKm: 25 },
    temporalScope: { from: null, to: null, asOf: null },
    requestedDomains: ['satellite'],
    requiresEvidence: true,
  })
  await provider.read(plan, 'model-input', '2026-09-24T04:00:00.000Z')
  await provider.read(plan, 'model-input', '2026-09-24T04:01:00.000Z')
  assert.equal(counter.celestrak, 1)
})

test('two-body orbital context returns finite geodetic context without claiming operational precision', () => {
  const point = propagateOmmContext({
    objectName: 'ISS (ZARYA)',
    objectId: '1998-067A',
    noradCatId: '25544',
    epoch: '2026-09-23T12:00:00.000Z',
    meanMotionRevPerDay: 15.49,
    eccentricity: 0.0006,
    inclinationDeg: 51.64,
    raanDeg: 120.5,
    argPericenterDeg: 81.2,
    meanAnomalyDeg: 42.3,
    elementSetNo: '999',
    revAtEpoch: '50000',
  }, new Date('2026-09-24T04:00:00.000Z'))
  assert.ok(point)
  assert.ok(Number.isFinite(point!.lat))
  assert.ok(Number.isFinite(point!.lon))
  assert.ok(point!.lat >= -90 && point!.lat <= 90)
  assert.ok(point!.lon >= -180 && point!.lon <= 180)
  assert.ok(point!.altitudeM > 100_000)
  assert.equal(point!.model, 'kepler-two-body-context-v1')
})

test('derived satellite context persists as evidence but cannot self-admit as Reality', async () => {
  const counter = { celestrak: 0, gibs: 0 }
  const evidenceStore = new InMemorySpatialEvidenceStore()
  const realityStore = new InMemorySpatialRealityStore()
  const satelliteProvider = createPublicSatelliteSpatialProvider({
    fetchImpl: fakeFetch(counter),
    now: () => '2026-09-24T04:00:00.000Z',
  })
  const evidenceRead = createGevSpatialContextReadProvider({
    satelliteProvider,
    evidenceStore,
    purpose: 'model-input',
    now: () => '2026-09-24T04:00:00.000Z',
  })
  const governed = createSpatialRealityAdmissionReadProvider({
    read: evidenceRead,
    evidenceStore,
    realityStore,
    now: () => '2026-09-24T04:00:01.000Z',
  })

  const result = await governed.read(imageryPlan(), 'user-1')
  assert.ok(result)
  assert.ok((result?.evidence.length ?? 0) >= 2)
  assert.equal(result?.reality.length, 0)
  assert.equal(result?.claims.length, 0)
  assert.ok(result?.limitations.some((item) => item.includes('non-admissible derived context')))
})
