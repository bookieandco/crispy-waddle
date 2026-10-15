import {
  createGevSourcePolicyRegistry,
  createPublicSatelliteSpatialProvider,
  normalizeUsgsEarthquakeGeoJson,
  type SatelliteReadResult,
  type SpatialObservation,
  type SpatialQueryPlan,
  type SpatialUsePurpose,
} from '@jhadina/spatial-intelligence-core'

/**
 * GEV-LIVE.02–.03: a bounded, read-only *in-process* adapter.
 * This is not a clone of the upstream GEV server and grants no Reality, memory,
 * publishing or action authority. It reuses Jhadina's policy and source models.
 */
export const GEV_LIVE_DOMAINS = ['earthquake', 'satellite', 'camera', 'aircraft', 'vessel', 'fire'] as const
export type GevLiveDomain = typeof GEV_LIVE_DOMAINS[number]
type GatewayStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'DENIED'
export type GatewaySource = {
  domain: GevLiveDomain
  sourceId: string
  status: GatewayStatus
  observedCount: number
  observations: SpatialObservation[]
  attribution: string
  termsRef: string
  limitations: string[]
}
export type GatewaySnapshot = {
  kind: 'GEV_SOURCE_GATEWAY_V1'
  checkedAt: string
  authority: 'INTELLIGENCE_ONLY'
  persisted: false
  admittedReality: false
  sources: GatewaySource[]
}

export type GatewayInput = {
  domains: GevLiveDomain[]
  purpose: 'model-input' | 'private-analysis'
}
type SatelliteReader = {
  read(plan: SpatialQueryPlan, purpose: SpatialUsePurpose, at: string): Promise<SatelliteReadResult>
}
export type GatewayDependencies = {
  fetchImpl?: typeof fetch
  satellite?: SatelliteReader
  now?: () => string
}

const sourceIds: Record<GevLiveDomain, string> = {
  earthquake: 'gev-usgs',
  satellite: 'gev-celestrak',
  camera: 'gev-cctv',
  aircraft: 'gev-opensky',
  vessel: 'gev-aisstream',
  fire: 'gev-firms',
}
const USGS_DAILY_GEOJSON = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
const MAX_UPSTREAM_BYTES = 786_432
const MAX_USGS_EVENTS = 24
const MAX_SATELLITE_OBSERVATIONS = 12
const TIMEOUT_MS = 6_000
const policy = createGevSourcePolicyRegistry()

const sourceInfo = (domain: GevLiveDomain) => {
  const sourceId = sourceIds[domain]
  const entry = policy.require(sourceId)
  return { domain, sourceId, attribution: entry.attribution, termsRef: entry.termsRef }
}

export function parseGatewayInput(value: unknown): GatewayInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GEV_GATEWAY_INPUT_INVALID')
  const data = value as Record<string, unknown>
  if (data.purpose !== 'model-input' && data.purpose !== 'private-analysis') {
    throw new Error('GEV_GATEWAY_PURPOSE_INVALID')
  }
  if (!Array.isArray(data.domains) || data.domains.length === 0 || data.domains.length > GEV_LIVE_DOMAINS.length) {
    throw new Error('GEV_GATEWAY_DOMAINS_INVALID')
  }
  const allowed = new Set<string>(GEV_LIVE_DOMAINS)
  if (!data.domains.every((domain): domain is GevLiveDomain => typeof domain === 'string' && allowed.has(domain))) {
    throw new Error('GEV_GATEWAY_DOMAINS_INVALID')
  }
  return { purpose: data.purpose, domains: [...new Set(data.domains)] as GevLiveDomain[] }
}

const unavailable = (domain: GevLiveDomain, reason: string): GatewaySource => ({
  ...sourceInfo(domain), status: 'UNAVAILABLE', observedCount: 0, observations: [],
  limitations: [reason],
})

async function boundedJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  // The URL is a code-owned literal, not derived from the request. No open proxy.
  if (url !== USGS_DAILY_GEOJSON) throw new Error('GEV_GATEWAY_UPSTREAM_FORBIDDEN')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetcher(url, {
      method: 'GET', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/geo+json, application/json' },
      next: { revalidate: 60 },
    } as RequestInit)
    if (!response.ok) throw new Error('GEV_GATEWAY_UPSTREAM_FAILED')
    const contentType = response.headers.get('content-type') ?? ''
    if (!/\b(json|geo\+json)\b/i.test(contentType)) throw new Error('GEV_GATEWAY_CONTENT_TYPE_INVALID')
    const declaredSize = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredSize) && declaredSize > MAX_UPSTREAM_BYTES) throw new Error('GEV_GATEWAY_BODY_TOO_LARGE')
    if (!response.body) throw new Error('GEV_GATEWAY_EMPTY_BODY')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_UPSTREAM_BYTES) throw new Error('GEV_GATEWAY_BODY_TOO_LARGE')
        chunks.push(value)
      }
    } finally {
      await reader.cancel().catch(() => {})
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } finally {
    clearTimeout(timer)
  }
}

async function usgsEarthquakeSource(at: string, fetcher: typeof fetch): Promise<GatewaySource> {
  const payload = await boundedJson(USGS_DAILY_GEOJSON, fetcher)
  const envelope = payload as { type?: unknown; features?: unknown[] }
  if (!envelope || envelope.type !== 'FeatureCollection' || !Array.isArray(envelope.features)) {
    throw new Error('GEV_GATEWAY_USGS_SCHEMA_INVALID')
  }
  // Never claim complete regional coverage: this is a bounded daily global feed.
  const observations = normalizeUsgsEarthquakeGeoJson(
    { features: envelope.features.slice(0, MAX_USGS_EVENTS) }, at,
  )
  return {
    ...sourceInfo('earthquake'),
    status: 'AVAILABLE',
    observedCount: observations.length,
    observations,
    limitations: ['USGS daily feed is bounded to 24 entries; earthquake reports can be delayed, revised or incomplete.'],
  }
}

async function satelliteSource(at: string, satellite: SatelliteReader): Promise<GatewaySource> {
  const plan: SpatialQueryPlan = {
    queryId: 'gev-live:stations', capability: 'READ_SPATIAL_CONTEXT',
    subject: 'CelesTrak stations', scope: null,
    temporalScope: { from: null, to: null, asOf: null },
    domains: ['satellite'], evidenceRequired: true,
  }
  const snapshot = await satellite.read(plan, 'model-input', at)
  const available = snapshot.sourceHealth.some((status) => status.startsWith('satellite:celestrak:available:'))
  if (!available) return unavailable('satellite', 'CelesTrak is unavailable; no orbital observations were certified.')
  return {
    ...sourceInfo('satellite'), status: 'AVAILABLE',
    observations: snapshot.observations.filter((obs) => obs.provenance.source_ref === 'gev-celestrak').slice(0, MAX_SATELLITE_OBSERVATIONS),
    observedCount: snapshot.observations.filter((obs) => obs.provenance.source_ref === 'gev-celestrak').length,
    limitations: [
      'CelesTrak positions are derived estimates and are not operational ground truth or safe for navigation.',
      'This source gateway does not admit observations into Spatial Reality.',
    ],
  }
}

export async function readGevLiveSourceGateway(
  input: GatewayInput, dependencies: GatewayDependencies = {},
): Promise<GatewaySnapshot> {
  const parsed = parseGatewayInput(input)
  const at = (dependencies.now ?? (() => new Date().toISOString()))()
  const fetcher = dependencies.fetchImpl ?? fetch
  const satellite = dependencies.satellite ?? createPublicSatelliteSpatialProvider()
  const results: GatewaySource[] = []
  for (const domain of parsed.domains) {
    const sourceId = sourceIds[domain]
    const decision = policy.decide(sourceId, parsed.purpose)
    if (!decision.allowed) {
      results.push({
        ...sourceInfo(domain), status: 'DENIED', observedCount: 0, observations: [],
        limitations: ['Source policy does not permit this purpose.'],
      })
      continue
    }
    if (domain !== 'earthquake' && domain !== 'satellite') {
      // CCTV, OpenSky, AISStream and FIRMS must not be simulated or relabeled.
      // They require an approved, configured upstream in LIVE.04.
      results.push(unavailable(domain, 'No commissioned read-only provider for this domain.'))
      continue
    }
    try {
      results.push(domain === 'earthquake'
        ? await usgsEarthquakeSource(at, fetcher)
        : await satelliteSource(at, satellite))
    } catch {
      results.push(unavailable(domain, 'Permitted upstream data could not be verified.'))
    }
  }
  return {
    kind: 'GEV_SOURCE_GATEWAY_V1', checkedAt: at,
    authority: 'INTELLIGENCE_ONLY', persisted: false, admittedReality: false, sources: results,
  }
}
