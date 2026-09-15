import type { SpatialEvidence } from './evidence.js'
import type { SpatialObservation } from './observation.js'
import type { SpatialStream } from './spatial-pipeline.js'

export type GevCameraRecord = {
  id: string
  name?: string
  city?: string
  lat: number
  lon: number
  headingDeg?: number
  fovDeg?: number
  pitchDeg?: number
  capability?: SpatialStream['capability']
  frameUrl?: string
  mediaUrl?: string
  sourceId?: string
  attribution?: string
}

export type GevCameraSnapshot = {
  camera: GevCameraRecord
  observedAt: string | null
  receivedAt: string
  frameRef: string | null
  sourceRecordId?: string | null
}

export interface GevSpatialAdapter {
  normalizeCamera(camera: GevCameraRecord): GevCameraRecord
  toObservation(snapshot: GevCameraSnapshot): SpatialObservation
  toEvidence(snapshot: GevCameraSnapshot, observationId: string, contentHash: string): SpatialEvidence
}

function assertCoordinate(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('GEV_CAMERA_COORDINATE_INVALID')
}

export const createGevSpatialAdapter = (): GevSpatialAdapter => ({
  normalizeCamera(camera) {
    assertCoordinate(camera.lat, camera.lon)
    if (!camera.id) throw new Error('GEV_CAMERA_ID_REQUIRED')
    return { ...camera, sourceId: camera.sourceId ?? 'gev-cctv' }
  },
  toObservation(snapshot) {
    const camera = createGevSpatialAdapter().normalizeCamera(snapshot.camera)
    return {
      observation_id: `gev:cctv:${camera.id}:${snapshot.receivedAt}`,
      entity: { id: camera.id, type: 'camera' },
      observation_type: 'camera_frame',
      observed_at: snapshot.observedAt,
      received_at: snapshot.receivedAt,
      source: { provider: 'gods-eye-view', record_id: snapshot.sourceRecordId ?? camera.id },
      position: { lat: camera.lat, lon: camera.lon },
      attributes: { name: camera.name ?? null, city: camera.city ?? null, headingDeg: camera.headingDeg ?? null, fovDeg: camera.fovDeg ?? null, pitchDeg: camera.pitchDeg ?? null, frameRef: snapshot.frameRef },
      quality: { freshness: snapshot.observedAt ? 'fresh' : 'unknown', completeness: 'partial', coverage: 'known' },
      provenance: { source_ref: camera.sourceId ?? 'gev-cctv', adapter_version: 'gev-adapter:v1' },
      inference: false,
    }
  },
  toEvidence(snapshot, observationId, contentHash) {
    const camera = createGevSpatialAdapter().normalizeCamera(snapshot.camera)
    return {
      evidence_id: `gev:evidence:${observationId}`,
      observation_id: observationId,
      source: { provider: 'gods-eye-view', record_id: snapshot.sourceRecordId ?? camera.id, attribution: camera.attribution ?? 'God’s Eye View source adapter' },
      timing: { observed_at: snapshot.observedAt, received_at: snapshot.receivedAt },
      coverage: { completeness: 'partial', coverage: 'known', freshness: snapshot.observedAt ? 'fresh' : 'unknown' },
      payload: { entity: { id: camera.id, type: 'camera' }, position: { lat: camera.lat, lon: camera.lon }, attributes: { frameRef: snapshot.frameRef, name: camera.name ?? null } },
      transformation: { adapter: 'gods-eye-view', adapter_version: 'gev-adapter:v1', normalized: true },
      integrity: { content_hash: contentHash },
    }
  },
})
