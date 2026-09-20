import type { SpatialEntityType, SpatialObservation } from './observation.js'
import type { GevCctvHealthEntry, GevCctvSource } from './gev-provider-bridge.js'

export type GevNormalizedSpatialRecord = {
  sourceId: string
  provider: string
  adapterVersion: string
  recordId: string
  entityId: string
  entityType: SpatialEntityType
  observationType: string
  observedAt: string | null
  receivedAt: string
  position: { lat: number; lon: number; altitudeM?: number | null } | null
  attributes: Record<string, unknown>
  freshness?: SpatialObservation['quality']['freshness']
  completeness?: SpatialObservation['quality']['completeness']
  coverage?: SpatialObservation['quality']['coverage']
}

const finite = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

const isoFromUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString()
  const numeric = finite(value)
  if (numeric === null) return null
  const millis = numeric < 10_000_000_000 ? numeric * 1000 : numeric
  const date = new Date(millis)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function validPosition(lat: unknown, lon: unknown, altitude?: unknown): { lat: number; lon: number; altitudeM?: number | null } | null {
  const latitude = finite(lat)
  const longitude = finite(lon)
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  const altitudeM = finite(altitude)
  return altitude === undefined ? { lat: latitude, lon: longitude } : { lat: latitude, lon: longitude, altitudeM }
}

export function gevRecordToSpatialObservation(record: GevNormalizedSpatialRecord): SpatialObservation {
  if (!record.sourceId || !record.provider || !record.adapterVersion || !record.recordId || !record.entityId || !record.observationType) {
    throw new Error('GEV_SPATIAL_RECORD_INVALID')
  }
  return {
    observation_id: `gev:${record.sourceId}:${record.recordId}:${record.receivedAt}`,
    entity: { id: record.entityId, type: record.entityType },
    observation_type: record.observationType,
    observed_at: record.observedAt,
    received_at: record.receivedAt,
    source: { provider: record.provider, record_id: record.recordId },
    position: record.position ? { lat: record.position.lat, lon: record.position.lon, altitude_m: record.position.altitudeM ?? null } : null,
    attributes: { ...record.attributes, sourceId: record.sourceId },
    quality: {
      freshness: record.freshness ?? (record.observedAt ? 'fresh' : 'unknown'),
      completeness: record.completeness ?? 'partial',
      coverage: record.coverage ?? 'partial',
    },
    provenance: { source_ref: record.sourceId, adapter_version: record.adapterVersion },
    inference: false,
  }
}

export function normalizeGevCctvSources(
  sources: readonly GevCctvSource[],
  receivedAt: string,
  health: readonly GevCctvHealthEntry[] = [],
): SpatialObservation[] {
  const healthById = new Map(health.map((entry) => [entry.id, entry]))
  return sources.map((source) => {
    const healthEntry = healthById.get(source.id)
    const healthUpdatedAt = isoFromUnknown(healthEntry?.updatedAt)
    const catalogSourceKind = source.sourceKind ?? null
    const sourceKind = healthEntry?.sourceKind || catalogSourceKind
    const fallbackActive = sourceKind === 'fallback' || sourceKind === 'streetview' || sourceKind === 'synthetic'
    return gevRecordToSpatialObservation({
      sourceId: 'gev-cctv', provider: source.provider || 'God\'s Eye View CCTV', adapterVersion: 'gev-source-adapters:v2', recordId: source.id,
      entityId: source.id, entityType: 'camera', observationType: healthEntry ? 'camera_source_state' : 'camera_catalog_entry', observedAt: healthUpdatedAt, receivedAt,
      position: validPosition(source.lat, source.lon),
      attributes: {
        name: source.name ?? null,
        city: source.city ?? null,
        headingDeg: source.headingDeg ?? null,
        pitchDeg: source.pitchDeg ?? null,
        fovDeg: source.fovDeg ?? null,
        feedType: source.feedType ?? null,
        sourceKind: sourceKind ?? null,
        catalogSourceKind,
        healthStatus: healthEntry?.status ?? null,
        healthLabel: healthEntry?.label ?? null,
        healthMessage: healthEntry?.message ?? null,
        healthUpdatedAt,
        fallbackActive,
        timestampSemantics: healthUpdatedAt ? 'provider-health-updated-at' : 'catalog-no-observation-time',
        license: source.license ?? null,
        credit: source.credit ?? null,
      },
      freshness: 'unknown', completeness: 'partial', coverage: 'known',
    })
  })
}

/** OpenSky /states/all adapter. Raw array offsets follow the OpenSky state-vector schema. */
export function normalizeOpenSkyPayload(payload: unknown, receivedAt: string): SpatialObservation[] {
  const root = payload as { states?: unknown[]; time?: unknown; source?: string; stale?: boolean }
  if (!Array.isArray(root?.states)) return []
  const snapshotTime = isoFromUnknown(root.time)
  const provider = typeof root.source === 'string' && root.source ? root.source : 'OpenSky Network'
  return root.states.flatMap((raw) => {
    if (!Array.isArray(raw)) return []
    const icao24 = typeof raw[0] === 'string' ? raw[0].trim() : ''
    if (!icao24) return []
    const position = validPosition(raw[6], raw[5], raw[7])
    const observedAt = isoFromUnknown(raw[4]) ?? snapshotTime
    return [gevRecordToSpatialObservation({
      sourceId: provider.toLowerCase().includes('adsb.lol') ? 'gev-adsblol' : 'gev-opensky', provider, adapterVersion: 'gev-source-adapters:v1', recordId: icao24,
      entityId: `aircraft:${icao24}`, entityType: 'aircraft', observationType: 'aircraft_state', observedAt, receivedAt, position,
      attributes: { callsign: typeof raw[1] === 'string' ? raw[1].trim() : null, originCountry: raw[2] ?? null, onGround: raw[8] ?? null, velocityMps: raw[9] ?? null, headingDeg: raw[10] ?? null, verticalRateMps: raw[11] ?? null, squawk: raw[14] ?? null, category: raw[17] ?? null },
      freshness: root.stale ? 'stale' : observedAt ? 'fresh' : 'unknown', completeness: position ? 'partial' : 'unknown', coverage: 'partial',
    })]
  })
}

export function normalizeAisPayload(payload: unknown, receivedAt: string): SpatialObservation[] {
  const root = payload as { rows?: unknown[]; source?: string; status?: string; newestPositionAt?: unknown }
  if (!Array.isArray(root?.rows)) return []
  const provider = typeof root.source === 'string' && root.source ? root.source : 'AISStream'
  return root.rows.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as Record<string, unknown>
    const mmsi = String(row.mmsi ?? row.MMSI ?? row.shipId ?? '').trim()
    if (!/^\d{5,10}$/.test(mmsi)) return []
    const position = validPosition(row.lat ?? row.latitude, row.lon ?? row.longitude)
    const observedAt = isoFromUnknown(row.observedAt ?? row.timestamp ?? row.time ?? root.newestPositionAt)
    return [gevRecordToSpatialObservation({
      sourceId: 'gev-aisstream', provider, adapterVersion: 'gev-source-adapters:v1', recordId: mmsi,
      entityId: `vessel:${mmsi}`, entityType: 'vessel', observationType: 'vessel_state', observedAt, receivedAt, position,
      attributes: { name: row.name ?? row.shipName ?? null, callsign: row.callsign ?? null, speedKnots: row.sog ?? row.speed ?? null, courseDeg: row.cog ?? row.course ?? null, headingDeg: row.heading ?? null, navigationStatus: row.navigationStatus ?? row.status ?? null },
      freshness: root.status === 'live' && observedAt ? 'fresh' : root.status === 'live' ? 'unknown' : 'stale', completeness: position ? 'partial' : 'unknown', coverage: 'partial',
    })]
  })
}

export function normalizeFirmsPayload(payload: unknown, receivedAt: string): SpatialObservation[] {
  const root = payload as { fires?: unknown[]; stale?: boolean; fetchedAt?: unknown }
  if (!Array.isArray(root?.fires)) return []
  return root.fires.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as Record<string, unknown>
    const position = validPosition(row.latitude ?? row.lat, row.longitude ?? row.lon)
    if (!position) return []
    const source = String(row.sensor ?? row.satellite ?? row.source ?? 'NASA FIRMS')
    const datePart = String(row.acq_date ?? row.acqDate ?? '').trim()
    const timePart = String(row.acq_time ?? row.acqTime ?? '').trim().padStart(4, '0')
    const observedAt = isoFromUnknown(row.observedAt ?? row.timestamp) ?? (datePart && /^\d{4}$/.test(timePart) ? isoFromUnknown(`${datePart}T${timePart.slice(0, 2)}:${timePart.slice(2)}:00Z`) : null) ?? isoFromUnknown(root.fetchedAt)
    const recordId = String(row.id ?? row.detectionId ?? `${source}:${position.lat}:${position.lon}:${observedAt ?? index}`)
    return [gevRecordToSpatialObservation({
      sourceId: 'gev-firms', provider: 'NASA FIRMS', adapterVersion: 'gev-source-adapters:v1', recordId,
      entityId: `fire-detection:${recordId}`, entityType: 'fire', observationType: 'active_fire_detection', observedAt, receivedAt, position,
      attributes: { sensor: row.sensor ?? null, satellite: row.satellite ?? null, confidence: row.confidence ?? null, brightness: row.bright_ti4 ?? row.brightness ?? null, frp: row.frp ?? null, daynight: row.daynight ?? null },
      freshness: root.stale ? 'stale' : observedAt ? 'fresh' : 'unknown', completeness: 'partial', coverage: 'partial',
    })]
  })
}

export function normalizeUsgsEarthquakeGeoJson(payload: unknown, receivedAt: string): SpatialObservation[] {
  const root = payload as { features?: unknown[] }
  if (!Array.isArray(root?.features)) return []
  return root.features.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const feature = raw as { id?: unknown; properties?: Record<string, unknown>; geometry?: { coordinates?: unknown[] } }
    const id = String(feature.id ?? '').trim()
    const coordinates = feature.geometry?.coordinates
    if (!id || !Array.isArray(coordinates)) return []
    const position = validPosition(coordinates[1], coordinates[0], coordinates[2] === undefined ? undefined : Number(coordinates[2]) * 1000)
    if (!position) return []
    const properties = feature.properties ?? {}
    const observedAt = isoFromUnknown(properties.time)
    return [gevRecordToSpatialObservation({
      sourceId: 'gev-usgs', provider: 'USGS', adapterVersion: 'gev-source-adapters:v1', recordId: id,
      entityId: `earthquake:${id}`, entityType: 'earthquake', observationType: 'earthquake_event', observedAt, receivedAt, position,
      attributes: { magnitude: properties.mag ?? null, place: properties.place ?? null, significance: properties.sig ?? null, tsunami: properties.tsunami ?? null, url: properties.url ?? null },
      freshness: observedAt ? 'fresh' : 'unknown', completeness: 'partial', coverage: 'known',
    })]
  })
}

export function normalizeInfrastructureRecord(input: { id: string; provider?: string; sourceId?: string; type?: string; name?: string; lat: number; lon: number; attributes?: Record<string, unknown> }, receivedAt: string): SpatialObservation {
  const position = validPosition(input.lat, input.lon)
  if (!input.id || !position) throw new Error('GEV_INFRASTRUCTURE_RECORD_INVALID')
  return gevRecordToSpatialObservation({
    sourceId: input.sourceId ?? 'gev-osm', provider: input.provider ?? 'OpenStreetMap contributors', adapterVersion: 'gev-source-adapters:v1', recordId: input.id,
    entityId: `infrastructure:${input.id}`, entityType: 'infrastructure', observationType: 'infrastructure_location', observedAt: null, receivedAt, position,
    attributes: { type: input.type ?? null, name: input.name ?? null, ...(input.attributes ?? {}) }, freshness: 'unknown', completeness: 'partial', coverage: 'partial',
  })
}

export function normalizeSatelliteRecord(input: { id: string; name?: string; provider?: string; observedAt?: string | null; lat?: number; lon?: number; altitudeM?: number | null; attributes?: Record<string, unknown> }, receivedAt: string): SpatialObservation {
  if (!input.id) throw new Error('GEV_SATELLITE_RECORD_INVALID')
  const hasPosition = input.lat !== undefined || input.lon !== undefined
  const position = hasPosition ? validPosition(input.lat, input.lon, input.altitudeM) : null
  if (hasPosition && !position) throw new Error('GEV_SATELLITE_POSITION_INVALID')
  return gevRecordToSpatialObservation({
    sourceId: 'gev-celestrak', provider: input.provider ?? 'CelesTrak', adapterVersion: 'gev-source-adapters:v1', recordId: input.id,
    entityId: `satellite:${input.id}`, entityType: 'satellite', observationType: position ? 'satellite_state' : 'satellite_catalog_entry', observedAt: input.observedAt ?? null, receivedAt, position,
    attributes: { name: input.name ?? null, ...(input.attributes ?? {}) }, freshness: input.observedAt ? 'fresh' : 'unknown', completeness: position ? 'partial' : 'unknown', coverage: 'partial',
  })
}
