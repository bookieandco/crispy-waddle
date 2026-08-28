export type GovernmentLevel =
  | 'FEDERAL'
  | 'STATE'
  | 'COUNTY'
  | 'MUNICIPAL'
  | 'SCHOOL_DISTRICT'
  | 'UNIVERSITY'
  | 'TRANSIT'
  | 'AIRPORT'
  | 'PORT'
  | 'UTILITY'
  | 'HOUSING_AUTHORITY'
  | 'HEALTH_SYSTEM'
  | 'SPECIAL_DISTRICT'
  | 'OTHER'

export type GovernmentSourceKind =
  | 'PROCUREMENT_PORTAL'
  | 'AGENCY_PROCUREMENT_PAGE'
  | 'FORECAST'
  | 'AWARD_DATABASE'
  | 'SUBCONTRACTING'
  | 'PUBLIC_NOTICE'
  | 'MEETING_AGENDA'
  | 'BUDGET'
  | 'CAPITAL_PLAN'
  | 'REGULATORY'
  | 'LICENSING'
  | 'GRANT_PROGRAM'
  | 'TAX_INCENTIVE'

export type GovernmentPortal =
  | 'SAM_GOV'
  | 'USA_SPENDING'
  | 'SBA_SUBNET'
  | 'GSA_FORECAST'
  | 'BONFIRE'
  | 'OPENGOV'
  | 'DEMANDSTAR'
  | 'PLANETBIDS'
  | 'IONWAVE'
  | 'BIDNET'
  | 'PUBLIC_PURCHASE'
  | 'EUNA'
  | 'AGENCY_NATIVE'
  | 'OTHER'

export interface GovernmentGeography {
  countryCode: string
  stateCode?: string
  countyCode?: string
  municipalityCode?: string
  postalCodes?: string[]
  name: string
}

export interface GovernmentEntity {
  id: string
  name: string
  level: GovernmentLevel
  geography: GovernmentGeography
  parentId?: string
  officialUrl?: string
  procurementUrl?: string
}

export interface GovernmentSource {
  id: string
  entityId: string
  entity: GovernmentEntity
  kind: GovernmentSourceKind
  portal: GovernmentPortal
  url: string
  official: boolean
  active: boolean
  capabilities: string[]
  discoverySignals: string[]
  freshnessMinutes?: number
  lastVerifiedAt?: string
}

export interface GovernmentSourceRegistry {
  list(filters?: {
    countryCode?: string
    stateCode?: string
    countyCode?: string
    municipalityCode?: string
    level?: GovernmentLevel
    kind?: GovernmentSourceKind
    portal?: GovernmentPortal
    active?: boolean
  }): GovernmentSource[]
  upsert(source: GovernmentSource): void
}

export function filterGovernmentSources(
  sources: GovernmentSource[],
  filters: Parameters<GovernmentSourceRegistry['list']>[0] = {},
): GovernmentSource[] {
  return sources.filter((source) => {
    const geography = source.entity.geography
    if (filters.countryCode && geography.countryCode !== filters.countryCode) return false
    if (filters.stateCode && geography.stateCode !== filters.stateCode) return false
    if (filters.countyCode && geography.countyCode !== filters.countyCode) return false
    if (filters.municipalityCode && geography.municipalityCode !== filters.municipalityCode) return false
    if (filters.level && source.entity.level !== filters.level) return false
    if (filters.kind && source.kind !== filters.kind) return false
    if (filters.portal && source.portal !== filters.portal) return false
    if (filters.active !== undefined && source.active !== filters.active) return false
    return true
  })
}

export function createInMemoryGovernmentSourceRegistry(
  initial: GovernmentSource[] = [],
): GovernmentSourceRegistry {
  const sources = new Map(initial.map((source) => [source.id, source]))
  return {
    list(filters) {
      return filterGovernmentSources([...sources.values()], filters)
    },
    upsert(source) {
      sources.set(source.id, source)
    },
  }
}
