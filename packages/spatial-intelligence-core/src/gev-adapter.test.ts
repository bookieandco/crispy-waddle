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

test('GEV adapter rejects invalid camera coordinates', () => {
  assert.throws(() => createGevSpatialAdapter().normalizeCamera({ id: 'bad', lat: 91, lon: 0 }), /GEV_CAMERA_COORDINATE_INVALID/)
})
