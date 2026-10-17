import {
  readGevLiveSourceGateway,
  type GatewayInput,
  type GatewaySnapshot,
  type GatewaySource,
} from './gev-live-source-gateway'

export type GevPublicSourceId = 'gev-usgs' | 'gev-celestrak'
export type GevPublicReadiness = {
  kind: 'GEV_PUBLIC_READINESS_V1'
  status: 'SOURCE_READABLE' | 'PARTIAL' | 'UNAVAILABLE'
  checkedAt: string
  scope: 'READ_ONLY_PUBLIC_SOURCE'
  productionCertified: false
  persisted: false
  admittedReality: false
  canAct: false
  databaseNotRequiredForSourceProbe: true
  /** Never treat source readability as verified durability or live ground truth. */
  sources: Array<{
    sourceId: GevPublicSourceId
    state: 'OBSERVED' | 'EMPTY' | 'UNAVAILABLE'
    sampleCount: number
    derivedEstimate: boolean
    limitation: string
  }>
  blockers: string[]
}

export type GevPublicReadinessOptions = {
  now?: () => string
  read?: (input: GatewayInput) => Promise<GatewaySnapshot>
}

const SOURCE_IDS: GevPublicSourceId[] = ['gev-usgs', 'gev-celestrak']
const MAX_SOURCE_SAMPLES = 24
const MAX_CHECK_AGE_MS = 5 * 60 * 1000

/** Read public USGS / CelesTrak sources independently of any licensed
 * GEV camera service, Supabase, or production canary writes. This is a
 * narrowly bounded source-probe result, never an admission or a PASS. */
export async function readGevPublicReadiness(
  options: GevPublicReadinessOptions = {},
): Promise<GevPublicReadiness> {
  const checkedAt = (options.now ?? (() => new Date().toISOString()))()
  const result: GevPublicReadiness = {
    kind: 'GEV_PUBLIC_READINESS_V1',
    status: 'UNAVAILABLE',
    checkedAt,
    scope: 'READ_ONLY_PUBLIC_SOURCE',
    productionCertified: false, persisted: false, admittedReality: false,
    canAct: false, databaseNotRequiredForSourceProbe: true,
    sources: [], blockers: [],
  }

  let snapshot: GatewaySnapshot | undefined
  try {
    snapshot = await (options.read ?? readGevLiveSourceGateway)({
      purpose: 'model-input', domains: ['earthquake', 'satellite'],
    })
  } catch {
    // Upstream, DNS, network, and provider exceptions must not surface to users.
  }
  const atMs = Date.parse(checkedAt)
  const snapMs = Date.parse(snapshot?.checkedAt ?? '')
  const valid = Boolean(snapshot?.kind === 'GEV_SOURCE_GATEWAY_V1' &&
    snapshot.authority === 'INTELLIGENCE_ONLY' &&
    snapshot.persisted === false && snapshot.admittedReality === false &&
    Number.isFinite(atMs) && Number.isFinite(snapMs) &&
    atMs - snapMs >= -60_000 && atMs - snapMs <= MAX_CHECK_AGE_MS &&
    Array.isArray(snapshot.sources))

  for (const sourceId of SOURCE_IDS) {
    const source: GatewaySource | undefined = valid
      ? snapshot?.sources.find(x => x.sourceId === sourceId)
      : undefined
    const observations = Array.isArray(source?.observations) ? source.observations : []
    const relevant = observations.filter(obs =>
      obs && typeof obs === 'object' &&
      obs.provenance?.source_ref === sourceId &&
      (sourceId === 'gev-celestrak' || obs.inference === false) &&
      typeof obs.observation_id === 'string' &&
      obs.observation_id.length > 0 &&
      typeof obs.received_at === 'string' &&
      Number.isFinite(Date.parse(obs.received_at)),
    )
    const available = source?.status === 'AVAILABLE' &&
      typeof source.observedCount === 'number' &&
      Number.isSafeInteger(source.observedCount) &&
      source.observedCount >= relevant.length &&
      source.observedCount >= 0 &&
      observations.length <= MAX_SOURCE_SAMPLES &&
      relevant.length === observations.length
    const state = !available ? 'UNAVAILABLE' : relevant.length ? 'OBSERVED' : 'EMPTY'
    result.sources.push({
      sourceId, state,
      sampleCount: state === 'UNAVAILABLE' ? 0 : relevant.length,
      derivedEstimate: sourceId === 'gev-celestrak',
      limitation: sourceId === 'gev-celestrak'
        ? 'CelesTrak orbits are derived context only, never ground truth or admitted Reality.'
        : 'USGS daily earthquake reports may be delayed or incomplete; no durable evidence was written.',
    })
    if (state === 'UNAVAILABLE') result.blockers.push(sourceId === 'gev-usgs'
      ? 'USGS_SOURCE_UNAVAILABLE' : 'CELESTRAK_SOURCE_UNAVAILABLE')
  }
  const count = result.sources.filter(x => x.state !== 'UNAVAILABLE').length
  result.status = count === 2 ? 'SOURCE_READABLE' : count === 1 ? 'PARTIAL' : 'UNAVAILABLE'
  return result
}
