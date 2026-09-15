export type SpatialEntityType = 'aircraft' | 'vessel' | 'satellite' | 'earthquake' | 'fire' | 'vehicle' | 'infrastructure' | 'camera' | 'unknown'

export type SpatialObservation = {
  observation_id: string
  entity: { id: string; type: SpatialEntityType }
  observation_type: string
  observed_at: string | null
  received_at: string
  source: { provider: string; record_id: string | null }
  position: { lat: number; lon: number; altitude_m?: number | null } | null
  attributes: Record<string, unknown>
  quality: {
    freshness: 'fresh' | 'stale' | 'unknown'
    completeness: 'complete' | 'partial' | 'unknown'
    coverage: 'known' | 'partial' | 'unknown'
  }
  provenance: { source_ref: string; adapter_version: string }
  inference: false
}

export function assertSpatialObservation(observation: SpatialObservation): void {
  if (!observation.observation_id || !observation.entity.id || !observation.observation_type) throw new Error('SPATIAL_OBSERVATION_ID_REQUIRED')
  if (!observation.source.provider || !observation.provenance.source_ref || !observation.provenance.adapter_version) throw new Error('SPATIAL_OBSERVATION_PROVENANCE_REQUIRED')
  if (Number.isNaN(Date.parse(observation.received_at))) throw new Error('SPATIAL_OBSERVATION_RECEIVED_AT_INVALID')
  if (observation.observed_at !== null && Number.isNaN(Date.parse(observation.observed_at))) throw new Error('SPATIAL_OBSERVATION_OBSERVED_AT_INVALID')
  if (observation.position && (!Number.isFinite(observation.position.lat) || observation.position.lat < -90 || observation.position.lat > 90 || !Number.isFinite(observation.position.lon) || observation.position.lon < -180 || observation.position.lon > 180)) throw new Error('SPATIAL_OBSERVATION_POSITION_INVALID')
  if (observation.inference !== false) throw new Error('SPATIAL_OBSERVATION_MUST_BE_OBSERVED')
}
