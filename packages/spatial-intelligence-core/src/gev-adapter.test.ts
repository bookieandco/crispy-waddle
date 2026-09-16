import { strict as assert } from 'node:assert'
import test from 'node:test'
import { createGevSpatialAdapter } from './gev-adapter.js'

test('GEV camera snapshots normalize into observed spatial records without inference', () => {
  const adapter = createGevSpatialAdapter()
  const snapshot = {
    camera: { id: 'cam-1', name: 'Test Camera', lat: 33.9, lon: -117.2, sourceId: 'gev-cctv' },
    observedAt: '2026-09-14T12:00:00.000Z',
    receivedAt: '2026-09-14T12:00:01.000Z',
    frameRef: 'frame:1',
  }
  const observation = adapter.toObservation(snapshot)
  assert.equal(observation.entity.type, 'camera')
  assert.equal(observation.inference, false)
  assert.equal(observation.provenance.source_ref, 'gev-cctv')
  assert.deepEqual(observation.position, { lat: 33.9, lon: -117.2 })
})

test('GEV adapter preserves provider source kind, feed type, attribution, and fallback state', () => {
  const adapter = createGevSpatialAdapter()
  const snapshot = {
    camera: {
      id: 'cam-2', lat: 33.9, lon: -117.2, sourceId: 'gev-cctv',
      attribution: 'Caltrans', license: 'public-open-data', feedType: 'jpeg', sourceKind: 'caltrans-open-data',
    },
    observedAt: '2026-09-14T12:00:00.000Z',
    receivedAt: '2026-09-14T12:00:01.000Z',
    frameRef: 'frame:2',
    fallback: false,
  }
  const observation = adapter.toObservation(snapshot)
  assert.equal(observation.attributes.sourceKind, 'caltrans-open-data')
  assert.equal(observation.attributes.feedType, 'jpeg')
  assert.equal(observation.attributes.attribution, 'Caltrans')
  assert.equal(observation.attributes.license, 'public-open-data')
  assert.equal(observation.attributes.fallback, false)
})

test('GEV adapter marks synthetic and fallback frames as fallback observations, never as inferred truth', () => {
  const adapter = createGevSpatialAdapter()
  const snapshot = {
    camera: { id: 'cam-3', lat: 33.9, lon: -117.2, sourceKind: 'synthetic' },
    observedAt: null,
    receivedAt: '2026-09-14T12:00:01.000Z',
    frameRef: 'frame:synthetic',
  }
  const observation = adapter.toObservation(snapshot)
  assert.equal(observation.attributes.fallback, true)
  assert.equal(observation.attributes.fallbackReason, 'synthetic')
  assert.equal(observation.quality.freshness, 'unknown')
  assert.equal(observation.inference, false)
})

test('GEV adapter rejects invalid camera coordinates', () => {
  assert.throws(() => createGevSpatialAdapter().normalizeCamera({ id: 'bad', lat: 91, lon: 0 }), /GEV_CAMERA_COORDINATE_INVALID/)
})
