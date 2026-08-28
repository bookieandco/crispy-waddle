export type GovernmentEntityKind =
  | 'STATE'
  | 'COUNTY'
  | 'MUNICIPALITY'
  | 'SCHOOL_DISTRICT'
  | 'UNIVERSITY'
  | 'TRANSIT'
  | 'AIRPORT'
  | 'PORT'
  | 'UTILITY'
  | 'HOUSING_AUTHORITY'
  | 'HEALTH_SYSTEM'
  | 'SPECIAL_DISTRICT'

export type GeographicScope = {
  country: string
  state?: string
  county?: string
  municipality?: string
}

export type GovernmentEntitySeed = {
  id: string
  name: string
  kind: GovernmentEntityKind
  scope: GeographicScope
}

export type ScanTarget = {
  entity: GovernmentEntitySeed
  sourceFamilies: string[]
  demandSurfaces: string[]
}

const SOURCE_FAMILIES = [
  'PROCUREMENT_PORTAL',
  'AGENCY_NATIVE',
  'AWARDS',
  'FORECASTS',
  'SUBCONTRACTING',
  'GRANTS',
  'BUDGETS',
  'CAPITAL_PLANS',
  'PUBLIC_NOTICES',
  'AGENDAS',
  'REGULATORY',
  'LICENSES',
] as const

const DEMAND_SURFACES = [
  'OPEN_BIDS',
  'PRE_SOLICITATIONS',
  'AWARDS',
  'EXPIRING_CONTRACTS',
  'RECURRING_SERVICES',
  'MANDATED_SERVICES',
  'GRANTS',
  'CAPITAL_PROJECTS',
] as const

/**
 * Expands a geographic government entity into deterministic discovery targets.
 * Adapters resolve these targets to actual authoritative URLs; this module
 * deliberately does not fabricate URLs or assert that a portal exists.
 */
export function buildScanTarget(entity: GovernmentEntitySeed): ScanTarget {
  return {
    entity,
    sourceFamilies: [...SOURCE_FAMILIES],
    demandSurfaces: [...DEMAND_SURFACES],
  }
}

export function buildGeographicScanPlan(entities: GovernmentEntitySeed[]): ScanTarget[] {
  const seen = new Set<string>()
  const targets: ScanTarget[] = []

  for (const entity of entities) {
    if (seen.has(entity.id)) continue
    seen.add(entity.id)
    targets.push(buildScanTarget(entity))
  }

  return targets
}
