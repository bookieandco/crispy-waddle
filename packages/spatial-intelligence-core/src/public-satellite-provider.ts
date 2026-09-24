import type { SpatialObservation } from './observation.js'
import type { SpatialQueryPlan } from './spatial-pipeline.js'
import { createGevSourcePolicyRegistry, type SpatialSourcePolicyRegistry, type SpatialUsePurpose } from './source-policy.js'

export type SatelliteFetchResponse = {
  ok: boolean
  status: number
  headers?: { get(name: string): string | null }
  json(): Promise<unknown>
  arrayBuffer(): Promise<ArrayBuffer>
}

export type SatelliteFetchLike = (
  url: string,
  init?: { method?: string; signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<SatelliteFetchResponse>

export type PublicSatelliteProviderOptions = {
  fetchImpl?: SatelliteFetchLike
  timeoutMs?: number
  celestrakCacheMs?: number
  policyRegistry?: SpatialSourcePolicyRegistry
  now?: () => string
}

export type SatelliteReadResult = {
  observations: SpatialObservation[]
  sourceHealth: string[]
  limitations: string[]
}

export type SatelliteHealthResult = {
  status: 'READY' | 'DEGRADED'
  celestrak: { reachable: boolean; recordCount: number }
  nasaGibs: { reachable: boolean; contentType: string | null; bytes: number | null }
  checkedAt: string
}

type ScopePoint = { lat: number; lon: number; radiusKm?: number }

type OmmRecord = {
  objectName: string
  objectId: string | null
  noradCatId: string
  epoch: string
  meanMotionRevPerDay: number
  eccentricity: number
  inclinationDeg: number
  raanDeg: number
  argPericenterDeg: number
  meanAnomalyDeg: number
  elementSetNo: string | null
  revAtEpoch: string | null
}

type PropagatedSubpoint = {
  lat: number
  lon: number
  altitudeM: number
  at: string
  model: 'kepler-two-body-context-v1'
}

const CELESTRAK_ORIGIN = 'https://celestrak.org'
const GIBS_ORIGIN = 'https://gibs.earthdata.nasa.gov'
const CELESTRAK_SOURCE = 'gev-celestrak'
const GIBS_SOURCE = 'nasa-gibs-viirs'
const DEFAULT_CACHE_MS = 2 * 60 * 60 * 1000
const EARTH_RADIUS_KM = 6378.137
const MU_KM3_S2 = 398600.4418
const MAX_SATELLITE_RESULTS = 24

const CELESTRAK_GROUPS = new Set([
  'stations',
  'weather',
  'resource',
  'sarsat',
  'radar',
])

const defaultFetch: SatelliteFetchLike = async (url, init) => await fetch(url, init) as SatelliteFetchResponse

const finite = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const normalizeLon = (degrees: number): number => {
  let value = degrees % 360
  if (value > 180) value -= 360
  if (value < -180) value += 360
  return value
}

const toRadians = (degrees: number): number => degrees * Math.PI / 180
const toDegrees = (radians: number): number => radians * 180 / Math.PI

const asScopePoint = (scope: unknown): ScopePoint | null => {
  if (!scope || typeof scope !== 'object') return null
  const raw = scope as Record<string, unknown>
  const lat = finite(raw.lat ?? raw.latitude)
  const lon = finite(raw.lon ?? raw.lng ?? raw.longitude)
  const radiusKm = finite(raw.radiusKm)
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon, ...(radiusKm !== null && radiusKm > 0 ? { radiusKm } : {}) }
}

const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(x))
}

const julianDate = (date: Date): number => date.getTime() / 86_400_000 + 2440587.5

const gmstRadians = (date: Date): number => {
  const jd = julianDate(date)
  const t = (jd - 2451545.0) / 36525
  const degrees = 280.46061837
    + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * t * t
    - (t * t * t) / 38710000
  return toRadians(((degrees % 360) + 360) % 360)
}

const solveEccentricAnomaly = (meanAnomaly: number, eccentricity: number): number => {
  let eccentricAnomaly = meanAnomaly
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const f = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly
    const fp = 1 - eccentricity * Math.cos(eccentricAnomaly)
    eccentricAnomaly -= f / fp
  }
  return eccentricAnomaly
}

export function propagateOmmContext(record: OmmRecord, at: Date): PropagatedSubpoint | null {
  const epochMs = Date.parse(record.epoch)
  if (!Number.isFinite(epochMs) || record.meanMotionRevPerDay <= 0 || record.eccentricity < 0 || record.eccentricity >= 1) return null

  const meanMotionRadSec = record.meanMotionRevPerDay * 2 * Math.PI / 86400
  const semiMajorKm = Math.cbrt(MU_KM3_S2 / (meanMotionRadSec * meanMotionRadSec))
  const elapsedSec = (at.getTime() - epochMs) / 1000
  const meanAnomaly = toRadians(record.meanAnomalyDeg) + meanMotionRadSec * elapsedSec
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, record.eccentricity)

  const xPerifocal = semiMajorKm * (Math.cos(eccentricAnomaly) - record.eccentricity)
  const yPerifocal = semiMajorKm * Math.sqrt(1 - record.eccentricity ** 2) * Math.sin(eccentricAnomaly)

  const raan = toRadians(record.raanDeg)
  const inclination = toRadians(record.inclinationDeg)
  const argPericenter = toRadians(record.argPericenterDeg)
  const cosO = Math.cos(raan), sinO = Math.sin(raan)
  const cosI = Math.cos(inclination), sinI = Math.sin(inclination)
  const cosW = Math.cos(argPericenter), sinW = Math.sin(argPericenter)

  const xEci = (cosO * cosW - sinO * sinW * cosI) * xPerifocal
    + (-cosO * sinW - sinO * cosW * cosI) * yPerifocal
  const yEci = (sinO * cosW + cosO * sinW * cosI) * xPerifocal
    + (-sinO * sinW + cosO * cosW * cosI) * yPerifocal
  const zEci = (sinW * sinI) * xPerifocal + (cosW * sinI) * yPerifocal

  const theta = gmstRadians(at)
  const xEcef = Math.cos(theta) * xEci + Math.sin(theta) * yEci
  const yEcef = -Math.sin(theta) * xEci + Math.cos(theta) * yEci
  const zEcef = zEci
  const radiusKm = Math.sqrt(xEcef ** 2 + yEcef ** 2 + zEcef ** 2)
  if (!Number.isFinite(radiusKm) || radiusKm <= EARTH_RADIUS_KM) return null

  const lat = toDegrees(Math.atan2(zEcef, Math.sqrt(xEcef ** 2 + yEcef ** 2)))
  const lon = normalizeLon(toDegrees(Math.atan2(yEcef, xEcef)))
  return {
    lat,
    lon,
    altitudeM: (radiusKm - EARTH_RADIUS_KM) * 1000,
    at: at.toISOString(),
    model: 'kepler-two-body-context-v1',
  }
}

const parseOmm = (payload: unknown): OmmRecord[] => {
  if (!Array.isArray(payload)) return []
  return payload.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const row = raw as Record<string, unknown>
    const objectName = text(row.OBJECT_NAME)
    const noradCatId = text(String(row.NORAD_CAT_ID ?? ''))
    const epoch = text(row.EPOCH)
    const meanMotionRevPerDay = finite(row.MEAN_MOTION)
    const eccentricity = finite(row.ECCENTRICITY)
    const inclinationDeg = finite(row.INCLINATION)
    const raanDeg = finite(row.RA_OF_ASC_NODE)
    const argPericenterDeg = finite(row.ARG_OF_PERICENTER)
    const meanAnomalyDeg = finite(row.MEAN_ANOMALY)
    if (!objectName || !noradCatId || !epoch || meanMotionRevPerDay === null || eccentricity === null
      || inclinationDeg === null || raanDeg === null || argPericenterDeg === null || meanAnomalyDeg === null) return []
    return [{
      objectName,
      objectId: text(row.OBJECT_ID),
      noradCatId,
      epoch,
      meanMotionRevPerDay,
      eccentricity,
      inclinationDeg,
      raanDeg,
      argPericenterDeg,
      meanAnomalyDeg,
      elementSetNo: text(String(row.ELEMENT_SET_NO ?? '')),
      revAtEpoch: text(String(row.REV_AT_EPOCH ?? '')),
    }]
  })
}

const chooseCelestrakGroup = (subject: string | null | undefined): string => {
  const value = (subject ?? '').toLowerCase()
  if (/\b(iss|space station|station)\b/.test(value)) return 'stations'
  if (/\b(weather|storm|cloud|hurricane|meteorolog)\b/.test(value)) return 'weather'
  if (/\b(sar|synthetic aperture radar|radar satellite)\b/.test(value)) return 'radar'
  if (/\b(search and rescue|sarsat)\b/.test(value)) return 'sarsat'
  if (/\b(earth observation|imagery|image|sentinel|landsat|resource|monitor)\b/.test(value)) return 'resource'
  return 'stations'
}

const xyzFor = (lat: number, lon: number, zoom: number): { x: number; y: number; z: number } => {
  const clippedLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const scale = 2 ** zoom
  const x = Math.floor((lon + 180) / 360 * scale)
  const latitudeRad = toRadians(clippedLat)
  const y = Math.floor((1 - Math.asinh(Math.tan(latitudeRad)) / Math.PI) / 2 * scale)
  return { x, y, z: zoom }
}

const previousUtcDate = (receivedAt: string): string => {
  const date = new Date(receivedAt)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

const approximateClosestApproach = (
  record: OmmRecord,
  scope: ScopePoint,
  from: Date,
  horizonMinutes = 360,
  stepSeconds = 120,
): { at: string; distanceKm: number; subpoint: PropagatedSubpoint } | null => {
  let best: { at: string; distanceKm: number; subpoint: PropagatedSubpoint } | null = null
  const steps = Math.floor(horizonMinutes * 60 / stepSeconds)
  for (let index = 0; index <= steps; index += 1) {
    const at = new Date(from.getTime() + index * stepSeconds * 1000)
    const subpoint = propagateOmmContext(record, at)
    if (!subpoint) continue
    const distanceKm = haversineKm(scope, subpoint)
    if (!best || distanceKm < best.distanceKm) best = { at: at.toISOString(), distanceKm, subpoint }
  }
  return best
}

export class PublicSatelliteSpatialProvider {
  private readonly fetchImpl: SatelliteFetchLike
  private readonly timeoutMs: number
  private readonly cacheMs: number
  private readonly registry: SpatialSourcePolicyRegistry
  private readonly now: () => string
  private readonly cache = new Map<string, { expiresAt: number; records: OmmRecord[] }>()

  constructor(options: PublicSatelliteProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? defaultFetch
    this.timeoutMs = options.timeoutMs ?? 10_000
    this.cacheMs = options.celestrakCacheMs ?? DEFAULT_CACHE_MS
    this.registry = options.policyRegistry ?? createGevSourcePolicyRegistry()
    this.now = options.now ?? (() => new Date().toISOString())
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 500 || this.timeoutMs > 30_000) throw new Error('SATELLITE_TIMEOUT_INVALID')
    if (!Number.isFinite(this.cacheMs) || this.cacheMs < DEFAULT_CACHE_MS) throw new Error('SATELLITE_CELESTRAK_CACHE_TOO_SHORT')
  }

  private assertPurpose(sourceId: string, purpose: SpatialUsePurpose): void {
    const decision = this.registry.decide(sourceId, purpose)
    if (!decision.allowed) throw new Error(`SATELLITE_SOURCE_USE_NOT_ALLOWED:${sourceId}:${purpose}:${decision.disposition}`)
  }

  private async json(url: URL): Promise<unknown> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(url.toString(), { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`SATELLITE_HTTP_${response.status}`)
      return await response.json()
    } finally {
      clearTimeout(timer)
    }
  }

  private async getCelestrakGroup(group: string, purpose: SpatialUsePurpose): Promise<OmmRecord[]> {
    this.assertPurpose(CELESTRAK_SOURCE, purpose)
    if (!CELESTRAK_GROUPS.has(group)) throw new Error('SATELLITE_CELESTRAK_GROUP_NOT_ALLOWLISTED')
    const cached = this.cache.get(group)
    if (cached && cached.expiresAt > Date.now()) return cached.records.map((row) => ({ ...row }))

    const url = new URL('/NORAD/elements/gp.php', CELESTRAK_ORIGIN)
    url.searchParams.set('GROUP', group)
    url.searchParams.set('FORMAT', 'JSON')
    const records = parseOmm(await this.json(url))
    if (records.length === 0) throw new Error('SATELLITE_CELESTRAK_EMPTY')
    this.cache.set(group, { expiresAt: Date.now() + this.cacheMs, records })
    return records.map((row) => ({ ...row }))
  }

  private async gibsObservation(scope: ScopePoint, receivedAt: string, purpose: SpatialUsePurpose): Promise<SpatialObservation> {
    this.assertPurpose(GIBS_SOURCE, purpose)
    const date = previousUtcDate(receivedAt)
    const tile = xyzFor(scope.lat, scope.lon, 6)
    const path = `/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/${tile.z}/${tile.y}/${tile.x}.jpg`
    const url = new URL(path, GIBS_ORIGIN)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(url.toString(), { method: 'GET', signal: controller.signal, headers: { Accept: 'image/jpeg' } })
      if (!response.ok) throw new Error(`SATELLITE_GIBS_HTTP_${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength < 100) throw new Error('SATELLITE_GIBS_TILE_TOO_SMALL')
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
      const contentType = response.headers?.get('content-type') ?? 'image/jpeg'
      return {
        observation_id: `nasa-gibs:viirs-snpp:${date}:${tile.z}:${tile.x}:${tile.y}:${sha256.slice(0, 16)}:${receivedAt}`,
        entity: { id: `satellite-imagery:viirs-snpp:${date}:${tile.z}:${tile.x}:${tile.y}`, type: 'satellite' },
        observation_type: 'satellite_imagery_asset',
        observed_at: `${date}T12:00:00.000Z`,
        received_at: receivedAt,
        source: { provider: 'NASA GIBS / Worldview', record_id: `VIIRS_SNPP_CorrectedReflectance_TrueColor:${date}:${tile.z}:${tile.x}:${tile.y}` },
        position: null,
        attributes: {
          sourceId: GIBS_SOURCE,
          mission: 'Suomi NPP',
          sensor: 'VIIRS',
          layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
          layerDate: date,
          timestampSemantics: 'daily-layer-date-not-exact-acquisition-time',
          queryCenter: { lat: scope.lat, lon: scope.lon },
          queryRadiusKm: scope.radiusKm ?? null,
          tile,
          assetUrl: url.toString(),
          contentType,
          byteLength: bytes.byteLength,
          sha256,
          realityAdmissionEligible: false,
          derivedAssetContext: true,
        },
        quality: { freshness: 'unknown', completeness: 'partial', coverage: 'partial' },
        provenance: { source_ref: GIBS_SOURCE, adapter_version: 'public-satellite-provider:v1' },
        inference: false,
      }
    } finally {
      clearTimeout(timer)
    }
  }

  private orbitObservations(records: OmmRecord[], plan: SpatialQueryPlan, receivedAt: string): SpatialObservation[] {
    const at = new Date(receivedAt)
    const scope = asScopePoint(plan.scope)
    const ranked = records.flatMap((record) => {
      const subpoint = propagateOmmContext(record, at)
      if (!subpoint) return []
      const distanceToScopeKm = scope ? haversineKm(scope, subpoint) : null
      const nextClosestApproach = scope ? approximateClosestApproach(record, scope, at) : null
      return [{ record, subpoint, distanceToScopeKm, nextClosestApproach }]
    }).sort((a, b) => {
      const aDistance = a.nextClosestApproach?.distanceKm ?? a.distanceToScopeKm ?? Number.POSITIVE_INFINITY
      const bDistance = b.nextClosestApproach?.distanceKm ?? b.distanceToScopeKm ?? Number.POSITIVE_INFINITY
      return aDistance - bDistance
    }).slice(0, MAX_SATELLITE_RESULTS)

    return ranked.map(({ record, subpoint, distanceToScopeKm, nextClosestApproach }) => ({
      observation_id: `celestrak:${record.noradCatId}:${record.epoch}:${receivedAt}`,
      entity: { id: `satellite:${record.noradCatId}`, type: 'satellite' },
      observation_type: 'satellite_orbit_elements',
      observed_at: new Date(record.epoch).toISOString(),
      received_at: receivedAt,
      source: { provider: 'CelesTrak', record_id: record.noradCatId },
      position: null,
      attributes: {
        sourceId: CELESTRAK_SOURCE,
        objectName: record.objectName,
        objectId: record.objectId,
        noradCatId: record.noradCatId,
        epoch: record.epoch,
        meanMotionRevPerDay: record.meanMotionRevPerDay,
        eccentricity: record.eccentricity,
        inclinationDeg: record.inclinationDeg,
        raanDeg: record.raanDeg,
        argPericenterDeg: record.argPericenterDeg,
        meanAnomalyDeg: record.meanAnomalyDeg,
        elementSetNo: record.elementSetNo,
        revAtEpoch: record.revAtEpoch,
        derivedSubpoint: { ...subpoint },
        distanceToScopeKm,
        nextClosestApproach: nextClosestApproach ? {
          at: nextClosestApproach.at,
          distanceKm: nextClosestApproach.distanceKm,
          subpoint: nextClosestApproach.subpoint,
          horizonMinutes: 360,
          sampleStepSeconds: 120,
        } : null,
        propagationAccuracy: 'context-only-not-operational',
        realityAdmissionEligible: false,
      },
      quality: { freshness: 'unknown', completeness: 'partial', coverage: 'partial' },
      provenance: { source_ref: CELESTRAK_SOURCE, adapter_version: 'public-satellite-provider:v1' },
      inference: false,
    }))
  }

  async read(plan: SpatialQueryPlan, purpose: SpatialUsePurpose, receivedAt = this.now()): Promise<SatelliteReadResult> {
    const limitations: string[] = [
      'CelesTrak orbital ground positions are derived with a two-body Kepler context model, not SGP4; do not use them for navigation, collision avoidance, antenna pointing, or operational pass timing.',
      'NASA GIBS daily imagery tile timestamps identify the layer date, not the exact sensor acquisition instant.',
      'Satellite-derived context is intelligence-only and is not automatically admitted as canonical Reality.',
    ]
    const sourceHealth: string[] = []
    const observations: SpatialObservation[] = []

    const group = chooseCelestrakGroup(plan.subject)
    try {
      const records = await this.getCelestrakGroup(group, purpose)
      const orbitRows = this.orbitObservations(records, plan, receivedAt)
      observations.push(...orbitRows)
      sourceHealth.push(`satellite:celestrak:available:${orbitRows.length}:group=${group}`)
    } catch (error) {
      sourceHealth.push('satellite:celestrak:unavailable')
      limitations.push(`CelesTrak unavailable: ${error instanceof Error ? error.message : 'unknown error'}`)
    }

    const scope = asScopePoint(plan.scope)
    if (scope && /\b(imagery|image|earth observation|satellite view|what changed|compare|monitor|fire|smoke|flood|storm)\b/i.test(plan.subject ?? '')) {
      try {
        observations.push(await this.gibsObservation(scope, receivedAt, purpose))
        sourceHealth.push('satellite:nasa-gibs:available:1')
      } catch (error) {
        sourceHealth.push('satellite:nasa-gibs:unavailable')
        limitations.push(`NASA GIBS unavailable: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }

    return { observations, sourceHealth, limitations }
  }

  async health(purpose: SpatialUsePurpose = 'private-analysis'): Promise<SatelliteHealthResult> {
    const checkedAt = this.now()
    let celestrak = { reachable: false, recordCount: 0 }
    let nasaGibs: SatelliteHealthResult['nasaGibs'] = { reachable: false, contentType: null, bytes: null }

    try {
      const records = await this.getCelestrakGroup('stations', purpose)
      celestrak = { reachable: true, recordCount: records.length }
    } catch {}

    try {
      const observation = await this.gibsObservation({ lat: 33.942501, lon: -118.407997, radiusKm: 25 }, checkedAt, purpose)
      nasaGibs = {
        reachable: true,
        contentType: typeof observation.attributes.contentType === 'string' ? observation.attributes.contentType : null,
        bytes: typeof observation.attributes.byteLength === 'number' ? observation.attributes.byteLength : null,
      }
    } catch {}

    return {
      status: celestrak.reachable && nasaGibs.reachable ? 'READY' : 'DEGRADED',
      celestrak,
      nasaGibs,
      checkedAt,
    }
  }
}

export const createPublicSatelliteSpatialProvider = (
  options: PublicSatelliteProviderOptions = {},
): PublicSatelliteSpatialProvider => new PublicSatelliteSpatialProvider(options)
