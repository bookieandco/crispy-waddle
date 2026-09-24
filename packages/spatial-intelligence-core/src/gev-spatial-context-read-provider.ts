import { spatialEvidenceHash } from './evidence-hash.js'
import type { SpatialEvidence } from './evidence.js'
import type { SpatialEvidenceStore } from './evidence-store.js'
import type { SpatialObservation } from './observation.js'
import { normalizeAisPayload, normalizeFirmsPayload, normalizeGevCctvSources, normalizeOpenSkyPayload } from './gev-source-adapters.js'
import { GevProviderBridge } from './gev-provider-bridge.js'
import { createGevSourcePolicyRegistry, type SpatialSourcePolicyRegistry, type SpatialUsePurpose } from './source-policy.js'
import type { SpatialContextPackage, SpatialContextReadProvider } from './integration.js'
import type { SpatialQueryPlan } from './spatial-pipeline.js'
import type { EvidenceRef } from '@jhadina/core-spine'
import { spatialObservationToGraphContribution, type SpatialKnowledgeSink } from './spatial-knowledge-projection.js'
import { emitSpatialTelemetry, spatialTelemetryErrorCode, type SpatialTelemetrySink } from './spatial-telemetry.js'
import type { CctvCameraCatalogClient } from './cctv-camera-catalog.js'

export type GevSpatialReadProviderOptions = {
  bridge?: GevProviderBridge
  policyRegistry?: SpatialSourcePolicyRegistry
  now?: () => string
  maxEvidence?: number
  evidenceStore?: SpatialEvidenceStore
  knowledgeSink?: SpatialKnowledgeSink
  telemetry?: SpatialTelemetrySink
  cameraCatalog?: CctvCameraCatalogClient
  /** Governs provider/source reuse at this consumer boundary. Ask Jhadina uses model-input; Spatial workspace defaults to private-analysis. */
  purpose?: SpatialUsePurpose
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

const formatPosition = (position: unknown): string => {
  if (!position || typeof position !== 'object') return ''
  const raw = position as Record<string, unknown>
  const lat = Number(raw.lat)
  const lon = Number(raw.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ''
  const altitudeRaw = raw.altitude_m ?? raw.altitudeM
  const altitude = altitudeRaw === null || altitudeRaw === undefined ? null : Number(altitudeRaw)
  return ` at ${lat.toFixed(4)}, ${lon.toFixed(4)}${altitude !== null && Number.isFinite(altitude) ? ` alt ${Math.round(altitude)}m` : ''}`
}

const catalogSummary = (attributes: Record<string, unknown>): string | null => {
  if (attributes.catalogKind !== 'camera-specification') return null
  const brand = typeof attributes.brand === 'string' ? attributes.brand : 'Unknown brand'
  const model = typeof attributes.model === 'string' ? attributes.model : 'unknown model'
  const cameraType = typeof attributes.cameraType === 'string' ? attributes.cameraType : null
  const resolution = typeof attributes.resolutionLabel === 'string' ? attributes.resolutionLabel : null
  const megapixels = Number.isFinite(Number(attributes.megapixels)) ? `${Number(attributes.megapixels)}MP` : null
  const strings = (value: unknown, limit: number) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, limit)
    : []
  const protocols = strings(attributes.protocols, 8)
  const connectivity = strings(attributes.connectivity, 6)
  const powerSource = strings(attributes.powerSource, 6)
  const features = strings(attributes.features, 6)
  const powerMethod = typeof attributes.powerMethod === 'string' ? attributes.powerMethod : null
  const nightVisionType = typeof attributes.nightVisionType === 'string' ? attributes.nightVisionType : null
  const nightVisionRange = Number.isFinite(Number(attributes.nightVisionRangeM)) ? `${Number(attributes.nightVisionRangeM)}m` : null
  const twoWayAudio = attributes.twoWayAudio === true ? 'two-way audio' : attributes.twoWayAudio === false ? 'no two-way audio' : null
  const lastVerified = typeof attributes.lastVerified === 'string' ? attributes.lastVerified : null
  const capabilities = [
    cameraType,
    resolution ?? megapixels,
    protocols.length ? `protocols ${protocols.join(', ')}` : null,
    connectivity.length ? `connectivity ${connectivity.join(', ')}` : null,
    powerSource.length || powerMethod ? `power ${[...powerSource, powerMethod].filter(Boolean).join(', ')}` : null,
    nightVisionType ? `night vision ${nightVisionType}${nightVisionRange ? ` to ${nightVisionRange}` : ''}` : null,
    twoWayAudio,
    features.length ? `features ${features.join(', ')}` : null,
    lastVerified ? `catalog verified ${lastVerified}` : null,
  ].filter(Boolean)
  return `CCTV catalog specification for ${brand} ${model}${capabilities.length ? `: ${capabilities.join('; ')}` : ''}. Catalog metadata only; not evidence of deployment, location, or live-feed availability.`
}

const evidenceRef = (evidence: SpatialEvidence): EvidenceRef => ({
  id: evidence.evidenceId,
  source: evidence.source.provider,
  observedAt: evidence.timing.observedAt ?? evidence.timing.receivedAt,
  summary: catalogSummary(evidence.payload.attributes)
    ?? `${String(evidence.payload.entity.type ?? 'spatial')} observation ${String(evidence.payload.entity.id ?? evidence.observationId)}${formatPosition(evidence.payload.position)} from ${evidence.source.provider}`,
  immutable: true,
})

const observationRef = (observation: SpatialObservation): EvidenceRef => ({
  id: observation.observation_id,
  source: observation.source.provider,
  observedAt: observation.observed_at ?? observation.received_at,
  summary: catalogSummary(observation.attributes)
    ?? `${observation.observation_type}: ${observation.entity.id}${formatPosition(observation.position)}`,
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
  if (domains.has('camera')) domains.add('camera-catalog')
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
  private readonly purpose: SpatialUsePurpose

  constructor(private readonly options: GevSpatialReadProviderOptions) {
    this.registry = options.policyRegistry ?? createGevSourcePolicyRegistry()
    this.now = options.now ?? (() => new Date().toISOString())
    this.maxEvidence = options.maxEvidence ?? 500
    this.purpose = options.purpose ?? 'private-analysis'
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
        emitSpatialTelemetry(this.options.telemetry, {
          kind: 'provider_health', component: `gev:${domain}`, status: 'ok', at: receivedAt,
          details: { domain, observationCount: rows.length },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        sourceHealth.push(`${domain}:unavailable`)
        limitations.push(`${domain} source unavailable: ${message}`)
        emitSpatialTelemetry(this.options.telemetry, {
          kind: 'provider_health', component: `gev:${domain}`, status: 'degraded', at: receivedAt,
          details: { domain, errorCode: spatialTelemetryErrorCode(error) },
        })
        emitSpatialTelemetry(this.options.telemetry, {
          kind: 'source_failure', component: `gev:${domain}`, status: 'failed', at: receivedAt,
          details: { domain, errorCode: spatialTelemetryErrorCode(error) },
        })
      }
    }

    const point = asScopePoint(plan.scope)
    if (!this.options.bridge) {
      for (const domain of ['camera', 'aircraft', 'vessel', 'fire']) {
        if (domains.has(domain)) sourceHealth.push(`${domain}:unconfigured`)
      }
      if ([...domains].some((domain) => ['camera', 'aircraft', 'vessel', 'fire'].includes(domain))) {
        limitations.push('Live GEV provider is not configured; only independently configured spatial sources can contribute.')
      }
    }

    await Promise.all([
      ...(this.options.bridge ? [capture('camera', async () => {
        const sources = await this.options.bridge!.cctvSources(this.purpose)
        try {
          const health = await this.options.bridge.cctvHealth(this.purpose)
          sourceHealth.push(`camera-health:available:${health.length}`)
          emitSpatialTelemetry(this.options.telemetry, {
            kind: 'provider_health', component: 'gev:camera-health', status: 'ok', at: receivedAt,
            details: { domain: 'camera-health', cameraCount: health.length },
          })
          return normalizeGevCctvSources(sources, receivedAt, health)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown error'
          sourceHealth.push('camera-health:unavailable')
          limitations.push(`camera health unavailable: ${message}`)
          emitSpatialTelemetry(this.options.telemetry, {
            kind: 'provider_health', component: 'gev:camera-health', status: 'degraded', at: receivedAt,
            details: { domain: 'camera-health', errorCode: spatialTelemetryErrorCode(error) },
          })
          emitSpatialTelemetry(this.options.telemetry, {
            kind: 'source_failure', component: 'gev:camera-health', status: 'failed', at: receivedAt,
            details: { domain: 'camera-health', errorCode: spatialTelemetryErrorCode(error) },
          })
          return normalizeGevCctvSources(sources, receivedAt)
        }
      }),
      capture('aircraft', async () => normalizeOpenSkyPayload(await this.options.bridge!.openSky(point ? { lat: point.lat, lon: point.lon } : {}, this.purpose), receivedAt)),
      capture('vessel', async () => normalizeAisPayload(await this.options.bridge!.aisLive(5_000, this.purpose), receivedAt)),
      capture('fire', async () => normalizeFirmsPayload(await this.options.bridge!.firms(this.purpose), receivedAt)),
      ] : []),
    ])

    if (domains.has('camera-catalog') && this.options.cameraCatalog && plan.subject?.trim()) {
      try {
        const rows = await this.options.cameraCatalog.searchObservations(plan.subject, this.purpose, receivedAt)
        observations.push(...rows)
        sourceHealth.push(`camera-catalog:available:${rows.length}`)
        emitSpatialTelemetry(this.options.telemetry, {
          kind: 'provider_health', component: 'cctv-database:catalog', status: 'ok', at: receivedAt,
          details: { domain: 'camera-catalog', observationCount: rows.length },
        })
      } catch (error) {
        limitations.push(`camera catalog unavailable: ${error instanceof Error ? error.message : 'unknown error'}`)
        sourceHealth.push('camera-catalog:unavailable')
        emitSpatialTelemetry(this.options.telemetry, {
          kind: 'source_failure', component: 'cctv-database:catalog', status: 'failed', at: receivedAt,
          details: { domain: 'camera-catalog', errorCode: spatialTelemetryErrorCode(error) },
        })
      }
    }

    for (const domain of domains) {
      if (!['spatial', 'camera', 'camera-catalog', 'aircraft', 'vessel', 'fire'].includes(domain)) {
        limitations.push(`${domain} adapter is available at the normalization layer but has no live GEV bridge endpoint in this provider configuration.`)
      }
    }

    const scoped = observations.filter((observation) => inScope(observation, plan.scope)).slice(0, this.maxEvidence)
    const evidence = scoped.map((observation) => observationToEvidence(observation, this.registry))
    if (this.options.evidenceStore) {
      try {
        const outcomes = await Promise.all(evidence.map((item) => this.options.evidenceStore!.append(item)))
        emitSpatialTelemetry(this.options.telemetry, {
          kind: 'evidence_write', component: 'spatial-evidence-store', status: 'ok', at: receivedAt,
          details: {
            attempted: outcomes.length,
            appended: outcomes.filter((outcome) => outcome === 'APPENDED').length,
            duplicate: outcomes.filter((outcome) => outcome === 'DUPLICATE').length,
          },
        })
      } catch (error) {
        emitSpatialTelemetry(this.options.telemetry, {
          kind: 'evidence_write', component: 'spatial-evidence-store', status: 'failed', at: receivedAt,
          details: { attempted: evidence.length, errorCode: spatialTelemetryErrorCode(error) },
        })
        throw error
      }
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
      subject: plan.subject ?? null,
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
