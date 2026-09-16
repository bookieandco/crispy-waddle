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
  license?: string
  feedType?: string
  sourceKind?: string
}

export type GevCameraSnapshot = {
  camera: GevCameraRecord
  observedAt: string | null
  receivedAt: string
  frameRef: string | null
  sourceRecordId?: string | null
  sourceKind?: string
  feedType?: string
  fallback?: boolean
  fallbackReason?: string | null
}

export interface GevSpatialAdapter {
  normalizeCamera(camera: GevCameraRecord): GevCameraRecord
  toObservation(snapshot: GevCameraSnapshot): SpatialObservation
  toEvidence(snapshot: GevCameraSnapshot, observationId: string, contentHash: string): SpatialEvidence
}

function assertCoordinate(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('GEV_CAMERA_COORDINATE_INVALID')
}

function normalizeSourceKind(snapshot: GevCameraSnapshot): string {
  return String(snapshot.sourceKind ?? snapshot.camera.sourceKind ?? 'configured').trim() || 'configured'
}

function normalizeFeedType(snapshot: GevCameraSnapshot): string | null {
  const value = String(snapshot.feedType ?? snapshot.camera.feedType ?? '').trim().toLowerCase()
  return value || null
}

function fallbackState(snapshot: GevCameraSnapshot): { fallback: boolean; reason: string | null } {
  const sourceKind = normalizeSourceKind(snapshot).toLowerCase()
  const fallback = snapshot.fallback === true || sourceKind.includes('synthetic') || sourceKind.includes('fallback') || sourceKind.includes('street-view')
  return { fallback, reason: fallback ? snapshot.fallbackReason ?? sourceKind : null }
}

export const createGevSpatialAdapter = (): GevSpatialAdapter => ({
  normalizeCamera(camera) {
    assertCoordinate(camera.lat, camera.lon)
    if (!camera.id) throw new Error('GEV_CAMERA_ID_REQUIRED')
    return { ...camera, sourceId: camera.sourceId ?? 'gev-cctv' }
  },
  toObservation(snapshot) {
    const camera = createGevSpatialAdapter().normalizeCamera(snapshot.camera)
    const sourceKind = normalizeSourceKind(snapshot)
    const feedType = normalizeFeedType(snapshot)
    const fallback = fallbackState(snapshot)
    return {
      observation_id: `gev:cctv:${camera.id}:${snapshot.receivedAt}`,
      entity: { id: camera.id, type: 'camera' },
      observation_type: 'camera_frame',
      observed_at: snapshot.observedAt,
      received_at: snapshot.receivedAt,
      source: { provider: 'gods-eye-view', record_id: snapshot.sourceRecordId ?? camera.id },
      position: { lat: camera.lat, lon: camera.lon },
      attributes: {
        name: camera.name ?? null,
        city: camera.city ?? null,
        headingDeg: camera.headingDeg ?? null,
        fovDeg: camera.fovDeg ?? null,
        pitchDeg: camera.pitchDeg ?? null,
        frameRef: snapshot.frameRef,
        sourceKind,
        feedType,
        fallback: fallback.fallback,
        fallbackReason: fallback.reason,
        attribution: camera.attribution ?? null,
        license: camera.license ?? null,
      },
      quality: {
        freshness: snapshot.observedAt ? 'fresh' : 'unknown',
        completeness: 'partial',
        coverage: 'known',
      },
      provenance: { source_ref: camera.sourceId ?? 'gev-cctv', adapter_version: 'gev-adapter:v2' },
      inference: false,
    }
  },
  toEvidence(snapshot, observationId, contentHash) {
    const camera = createGevSpatialAdapter().normalizeCamera(snapshot.camera)
    const sourceKind = normalizeSourceKind(snapshot)
    const feedType = normalizeFeedType(snapshot)
    const fallback = fallbackState(snapshot)
    return {
      evidenceId: `gev:evidence:${observationId}`,
      observationId,
      source: { provider: 'gods-eye-view', recordId: snapshot.sourceRecordId ?? camera.id, attribution: camera.attribution ?? 'God’s Eye View source adapter' },
      timing: { observedAt: snapshot.observedAt, receivedAt: snapshot.receivedAt },
      coverage: { completeness: 'partial', coverage: 'known', freshness: snapshot.observedAt ? 'fresh' : 'unknown' },
      payload: {
        entity: { id: camera.id, type: 'camera' },
        position: { lat: camera.lat, lon: camera.lon },
        attributes: {
          frameRef: snapshot.frameRef,
          name: camera.name ?? null,
          sourceKind,
          feedType,
          fallback: fallback.fallback,
          fallbackReason: fallback.reason,
          attribution: camera.attribution ?? null,
          license: camera.license ?? null,
        },
      },
      transformation: { adapter: 'gods-eye-view', adapterVersion: 'gev-adapter:v2', normalized: true },
      integrity: { contentHash },
    }
  },
})
