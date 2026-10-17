import {
  type SpatialContextPackage,
  type SpatialContextReadProvider,
  type SpatialQueryPlan,
  type SpatialObservation,
} from '@jhadina/spatial-intelligence-core'
import { readGevLiveSourceGateway, type GatewaySnapshot } from './gev-live-source-gateway'

type GatewayReader = (domains: { purpose: 'model-input'; domains: ['earthquake'] }) => Promise<GatewaySnapshot>
export type GevLiveReadOptions = { readGateway?: GatewayReader; now?: () => string }

const RADIUS_EARTH_KM = 6371.0088
const distanceKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const rad = (x: number) => x * Math.PI / 180
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * RADIUS_EARTH_KM * Math.asin(Math.sqrt(h))
}

function inRequestedScope(obs: SpatialObservation, scope: unknown): boolean {
  if (scope === null || scope === undefined) return true
  if (!scope || typeof scope !== 'object' || !obs.position) return false
  const raw = scope as Record<string, unknown>
  const bbox = raw.bbox && typeof raw.bbox === 'object' ? raw.bbox as Record<string, unknown> : raw
  if (['south', 'north', 'west', 'east'].every(k => bbox[k] !== undefined)) {
    const south = Number(bbox.south), north = Number(bbox.north), west = Number(bbox.west), east = Number(bbox.east)
    return [south, north, west, east].every(Number.isFinite) &&
      south >= -90 && north <= 90 && west >= -180 && east <= 180 && south <= north && west <= east &&
      obs.position.lat >= south && obs.position.lat <= north && obs.position.lon >= west && obs.position.lon <= east
  }
  const lat = Number(raw.lat ?? raw.latitude), lon = Number(raw.lon ?? raw.lng ?? raw.longitude)
  const radiusKm = Number(raw.radiusKm)
  if (![lat, lon, radiusKm].every(Number.isFinite) || lat < -90 || lat > 90 || lon < -180 || lon > 180 ||
    radiusKm <= 0 || radiusKm > 20_000) return false
  return distanceKm({ lat, lon }, obs.position) <= radiusKm
}

export function mergeSpatialContextReadPackages(
  primary: SpatialContextPackage | undefined,
  supplement: SpatialContextPackage | undefined,
): SpatialContextPackage | undefined {
  if (!supplement) return primary
  if (!primary) return supplement
  const unique = <T extends { id: string }>(refs: T[]): T[] => {
    const ids = new Set<string>()
    return refs.filter(ref => { if (ids.has(ref.id)) return false; ids.add(ref.id); return true })
  }
  return {
    ...primary,
    observations: unique([...primary.observations, ...supplement.observations]),
    evidence: unique([...primary.evidence, ...supplement.evidence]),
    claims: unique([...primary.claims, ...supplement.claims]),
    reality: unique([...primary.reality, ...supplement.reality]),
    provenance: unique([...primary.provenance, ...supplement.provenance]),
    sourceHealth: [...new Set([...primary.sourceHealth, ...supplement.sourceHealth])],
    conflicts: [...new Set([...primary.conflicts, ...supplement.conflicts])],
    uncertainty: [...new Set([...primary.uncertainty, ...supplement.uncertainty])],
    limitations: [...new Set([...primary.limitations, ...supplement.limitations])],
    // Primary's workspace and admission identity must never be overwritten.
  }
}

/**
 * GEV-LIVE.08: explicitly read-only external observations for Ask/Spatial.
 * This is an *observation* contribution, not an Evidence receipt or Reality.
 * Existing canonical evidence/admission remains the only promotion authority.
 */
export function createGevLiveObservationReadProvider(options: GevLiveReadOptions = {}): SpatialContextReadProvider {
  return {
    async read(plan: SpatialQueryPlan): Promise<SpatialContextPackage | undefined> {
      if (!plan.domains.some(domain => domain.toLowerCase() === 'earthquake')) return undefined
      const at = (options.now ?? (() => new Date().toISOString()))()
      const base: SpatialContextPackage = {
        subject: plan.subject ?? null,
        geographicScope: plan.scope,
        temporalScope: plan.temporalScope,
        observations: [], evidence: [], claims: [], reality: [], patterns: [],
        predictions: [], scenarios: [], hypotheses: [], sourceHealth: [], conflicts: [], uncertainty: [],
        limitations: [], workspaceRef: null, investigationRef: null, provenance: [],
      }
      // A live daily snapshot cannot answer as-of historical questions.
      if (plan.temporalScope.asOf && Date.parse(plan.temporalScope.asOf) < Date.parse(at) - 2 * 60_000) {
        return { ...base, sourceHealth: ['earthquake:gateway:historical-unavailable'],
          limitations: ['Live USGS daily feed cannot substantiate a historical as-of snapshot.'] }
      }
      try {
        const read = options.readGateway ?? readGevLiveSourceGateway
        const snapshot = await read({ purpose: 'model-input', domains: ['earthquake'] })
        const source = snapshot.sources.find(row => row.sourceId === 'gev-usgs')
        if (!source || source.status !== 'AVAILABLE' || snapshot.authority !== 'INTELLIGENCE_ONLY' ||
          snapshot.persisted || snapshot.admittedReality) {
          return { ...base, sourceHealth: ['earthquake:gateway:unavailable'],
            limitations: ['USGS gateway observation source unavailable or not verified.'] }
        }
        const observations = source.observations
          .filter(obs => obs.provenance.source_ref === 'gev-usgs' && obs.inference === false && inRequestedScope(obs, plan.scope))
          .filter(obs => {
            const time = Date.parse(obs.observed_at ?? '')
            return Number.isFinite(time) &&
              (!plan.temporalScope.from || time >= Date.parse(plan.temporalScope.from)) &&
              (!plan.temporalScope.to || time <= Date.parse(plan.temporalScope.to))
          })
          .slice(0, 24)
          .map(obs => ({
            id: obs.observation_id,
            source: 'USGS observation (unadmitted)',
            observedAt: obs.observed_at ?? obs.received_at,
            summary: `Earthquake report ${String(obs.attributes.place ?? obs.entity.id).slice(0, 120)}; magnitude ${String(obs.attributes.magnitude ?? 'unknown').slice(0, 12)}. Unverified observation, not canonical Reality.`,
            immutable: false,
          }))
        return {
          ...base,
          observations,
          sourceHealth: [`earthquake:gateway:available:${source.observedCount}`],
          limitations: [
            'USGS gateway observations are read-only, bounded and not persisted or admitted as Reality.',
            ...(plan.scope ? ['Results filtered to requested valid location scope; incomplete coverage does not mean no events.'] : []),
            ...source.limitations,
          ],
          uncertainty: ['This is a daily report feed, not real-time ground confirmation.'],
        }
      } catch {
        return { ...base, sourceHealth: ['earthquake:gateway:unavailable'],
          limitations: ['Live USGS gateway read failed closed.'] }
      }
    },
  }
}
