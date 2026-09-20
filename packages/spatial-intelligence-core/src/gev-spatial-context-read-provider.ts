import { spatialEvidenceHash } from './evidence-hash.js'
import type { SpatialEvidence } from './evidence.js'
import type { SpatialEvidenceStore } from './evidence-store.js'
import type { SpatialObservation } from './observation.js'
import { normalizeAisPayload, normalizeFirmsPayload, normalizeGevCctvSources, normalizeOpenSkyPayload } from './gev-source-adapters.js'
import { GevProviderBridge } from './gev-provider-bridge.js'
import { createGevSourcePolicyRegistry, type SpatialSourcePolicyRegistry } from './source-policy.js'
import type { SpatialContextPackage, SpatialContextReadProvider } from './integration.js'
import type { SpatialQueryPlan } from './spatial-pipeline.js'
import type { EvidenceRef } from '@jhadina/core-spine'
import { spatialObservationToGraphContribution, type SpatialKnowledgeSink } from './spatial-knowledge-projection.js'

export type GevSpatialReadProviderOptions = {
  bridge: GevProviderBridge
  policyRegistry?: SpatialSourcePolicyRegistry
  now?: () => string
  maxEvidence?: number
  evidenceStore?: SpatialEvidenceStore
  knowledgeSink?: SpatialKnowledgeSink
}

type ScopePoint = { lat: number; lon: number; radiusKm?: number }
type ScopeBox = { south: number; north: number; west: number; east: number }

const asScopePoint = (scope: unknown): ScopePoint | null => {
  if (!scope || typeof scope !== 'object') return null
  const raw = scope as Record<string, unknown>
  const lat = Number(raw.lat ?? raw.latitude)
  const lon = Number(raw.lon ?? raw.lng ?? raw.longitude)
  const radiusKm = raw.radiusKm === undefined ? undefined : Number(raw.radiusKm)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon, ...(Number.isFinite(radiusKm) && (radiusKm as number) > 0 ? { radiusKm } : {}) }
}

const asScopeBox = (scope: unknown): ScopeBox | null => {
  if (!scope || typeof scope !== 'object') return null
  const root = scope as Record<string, unknown>
  const raw = (root.bbox && typeof root.bbox === 'object' ? root.bbox : root) as Record<string, unknown>
  const south = Number(raw.south), north = Number(raw.north), west = Number(raw.west), east = Number(raw.east)
  if (![south, north, west, east].every(Number.isFinite) || south < -90 || north > 90 || west < -180 || east > 180 || south > north || west > east) return null
  return { south, north, west, east }
}

const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const radians = (value: number) => value * Math.PI / 180
  const dLat = radians(b.lat - a.lat)
  const dLon = radians(b.lon - a.lon)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(x))
}

function inScope(observation: SpatialObservation, scope: unknown): boolean {
  if (!observation.position) return true
  const box = asScopeBox(scope)
  if (box) return observation.position.lat >= box.south && observation.position.lat <= box.north && observation.position.lon >= box.west && observation.position.lon <= box.east
  const point = asScopePoint(scope)
  if (point?.radiusKm) return haversineKm(point, observation.position) <= point.radiusKm
  return true
}

const observationToEvidence = (observation: SpatialObservation, registry: SpatialSourcePolicyRegistry): SpatialEvidence => {
  const sourceId = observation.provenance.source_ref
  const policy = registry.require(sourceId)
  const withoutIntegrity: Omit<SpatialEvidence, 'integrity'> = {
    evidenceId: `gev:evidence:${observation.observation_id}`,
    observationId: observation.observation_id,
    source: { provider: observation.source.provider, recordId: observation.source.record_id, attribution: policy.attribution },
    timing: { observedAt: observation.observed_at, receivedAt: observation.received_at },
    coverage: { ...observation.quality },
    payload: {
      entity: { ...observation.entity },
      position: observation.position ? { ...observation.position } : null,
      attributes: {
        ...observation.attributes,
        sourcePolicy: {
          sourceId: policy.sourceId,
          termsRef: policy.termsRef,
          privacyClass: policy.privacyClass,
          commercialUse: policy.commercialUse,
          publication: policy.publication,
          modelInput: policy.modelInput,
          replay: policy.replay,
          redistribution: policy.redistribution,
          retention: policy.retention,
          limitations: [...policy.limitations],
        },
      },
    },
    transformation: { adapter: 'gev-spatial-read-provider', adapterVersion: 'gev-spatial-read-provider:v1', normalized: true },
  }
  return { ...withoutIntegrity, integrity: { contentHash: spatialEvidenceHash(withoutIntegrity) } }
}

const evidenceRef = (evidence: SpatialEvidence): EvidenceRef => ({
  id: evidence.evidenceId,
  source: evidence.source.provider,
  observedAt: evidence.timing.observedAt ?? evidence.timing.receivedAt,
  summary: `${String(evidence.payload.entity.type ?? 'spatial')} observation ${String(evidence.payload.entity.id ?? evidence.observationId)} from ${evidence.source.provider}`,
  immutable: true,
})

const observationRef = (observation: SpatialObservation): EvidenceRef => ({
  id: observation.observation_id,
  source: observation.source.provider,
  observedAt: observation.observed_at ?? observation.received_at,
  summary: `${observation.observation_type}: ${observation.entity.id}`,
  immutable: true,
})

function requestedDomains(plan: SpatialQueryPlan): Set<string> {
  const domains = new Set(plan.domains.map((domain) => domain.toLowerCase()))
  if (domains.has('spatial')) {
    domains.add('camera')
    domains.add('aircraft')
    domains.add('vessel')
    domains.add('fire')
  }
  return domains
}

/**
 * Production-shaped read adapter over the GEV bridge. It emits observations and
 * immutable evidence only. claims[] and reality[] intentionally remain empty:
 * promotion belongs to the existing claim/reality admission pipeline.
 */
export class GevSpatialContextReadProvider implements SpatialContextReadProvider {
  private readonly registry: SpatialSourcePolicyRegistry
  private readonly now: () => string
  private readonly maxEvidence: number

  constructor(private readonly options: GevSpatialReadProviderOptions) {
    this.registry = options.policyRegistry ?? createGevSourcePolicyRegistry()
    this.now = options.now ?? (() => new Date().toISOString())
    this.maxEvidence = options.maxEvidence ?? 500
    if (!Number.isInteger(this.maxEvidence) || this.maxEvidence < 1 || this.maxEvidence > 10_000) throw new Error('GEV_SPATIAL_MAX_EVIDENCE_INVALID')
  }

  async read(plan: SpatialQueryPlan, _userId: string): Promise<SpatialContextPackage | undefined> {
    const domains = requestedDomains(plan)
    if (domains.size === 0) return undefined
    const receivedAt = this.now()
    const observations: SpatialObservation[] = []
    const sourceHealth: string[] = []
    const limitations: string[] = []

    const capture = async (domain: string, operation: () => Promise<SpatialObservation[]>): Promise<void> => {
      if (!domains.has(domain)) return
      try {
        const rows = await operation()
        observations.push(...rows)
        sourceHealth.push(`${domain}:available:${rows.length}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        sourceHealth.push(`${domain}:unavailable`)
        limitations.push(`${domain} source unavailable: ${message}`)
      }
    }

    const point = asScopePoint(plan.scope)
    await Promise.all([
      capture('camera', async () => {
        const sources = await this.options.bridge.cctvSources()
        try {
          const health = await this.options.bridge.cctvHealth()
          sourceHealth.push(`camera-health:available:${health.length}`)
          return normalizeGevCctvSources(sources, receivedAt, health)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown error'
          sourceHealth.push('camera-health:unavailable')
          limitations.push(`camera health unavailable: ${message}`)
          return normalizeGevCctvSources(sources, receivedAt)
        }
      }),
      capture('aircraft', async () => normalizeOpenSkyPayload(await this.options.bridge.openSky(point ? { lat: point.lat, lon: point.lon } : {}), receivedAt)),
      capture('vessel', async () => normalizeAisPayload(await this.options.bridge.aisLive(), receivedAt)),
      capture('fire', async () => normalizeFirmsPayload(await this.options.bridge.firms(), receivedAt)),
    ])

    for (const domain of domains) {
      if (!['spatial', 'camera', 'aircraft', 'vessel', 'fire'].includes(domain)) {
        limitations.push(`${domain} adapter is available at the normalization layer but has no live GEV bridge endpoint in this provider configuration.`)
      }
    }

    const scoped = observations.filter((observation) => inScope(observation, plan.scope)).slice(0, this.maxEvidence)
    const evidence = scoped.map((observation) => observationToEvidence(observation, this.registry))
    if (this.options.evidenceStore) {
      await Promise.all(evidence.map((item) => this.options.evidenceStore!.append(item)))
    } else if (evidence.length > 0) {
      limitations.push('Durable spatial evidence store is not configured; evidence is transient and cannot support reality admission.')
    }
    if (this.options.knowledgeSink) {
      await Promise.all(scoped.map((observation, index) => this.options.knowledgeSink!.persist(
        spatialObservationToGraphContribution(observation, evidence[index].evidenceId),
      )))
    } else if (evidence.length > 0) {
      limitations.push('Durable spatial knowledge graph sink is not configured; entity/source relationships are transient.')
    }
    const observationRefs = scoped.map(observationRef)
    const evidenceRefs = evidence.map(evidenceRef)
    const policyLimitations = [...new Set(scoped.flatMap((observation) => this.registry.require(observation.provenance.source_ref).limitations))]

    return {
      subject: null,
      geographicScope: plan.scope,
      temporalScope: { ...plan.temporalScope },
      observations: observationRefs,
      evidence: evidenceRefs,
      claims: [],
      reality: [],
      patterns: [],
      predictions: [],
      scenarios: [],
      hypotheses: [],
      sourceHealth: [...sourceHealth].sort(),
      conflicts: [],
      uncertainty: scoped.length === 0 ? ['No matching live observations were available for the requested scope.'] : [],
      limitations: [...new Set([...limitations, ...policyLimitations])].sort(),
      workspaceRef: null,
      investigationRef: null,
      provenance: evidenceRefs,
    }
  }
}

export const createGevSpatialContextReadProvider = (options: GevSpatialReadProviderOptions): GevSpatialContextReadProvider => new GevSpatialContextReadProvider(options)
