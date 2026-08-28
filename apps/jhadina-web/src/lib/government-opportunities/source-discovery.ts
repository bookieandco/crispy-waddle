import type { GovernmentLevel, GovernmentPortal, GovernmentSourceKind } from './source-registry'

export type GovernmentSourcePriority = 'PRIMARY' | 'SECONDARY' | 'DISCOVERY'

export interface GovernmentSourceDiscoveryRule {
  id: string
  name: string
  priority: GovernmentSourcePriority
  levels: GovernmentLevel[]
  kinds: GovernmentSourceKind[]
  portals: GovernmentPortal[]
  signals: string[]
  requiredEvidence: string[]
  notes?: string
}

/**
 * Deterministic discovery rules for expanding the Government Source Registry.
 * These rules intentionally discover sources; they do not assert that a source
 * is authoritative until evidence is captured and the source is verified.
 */
export const GOVERNMENT_SOURCE_DISCOVERY_RULES: GovernmentSourceDiscoveryRule[] = [
  {
    id: 'FEDERAL_PRIMARY',
    name: 'Federal procurement and award systems',
    priority: 'PRIMARY',
    levels: ['FEDERAL'],
    kinds: ['PROCUREMENT_PORTAL', 'AWARD_DATABASE', 'FORECAST', 'SUBCONTRACTING'],
    portals: ['SAM_GOV', 'USA_SPENDING', 'SBA_SUBNET', 'GSA_FORECAST'],
    signals: ['solicitation', 'pre-solicitation', 'award', 'forecast', 'subcontract'],
    requiredEvidence: ['official-domain', 'source-page', 'last-verified-at'],
  },
  {
    id: 'STATE_PRIMARY',
    name: 'State procurement systems',
    priority: 'PRIMARY',
    levels: ['STATE'],
    kinds: ['PROCUREMENT_PORTAL', 'FORECAST', 'AWARD_DATABASE', 'PUBLIC_NOTICE', 'BUDGET', 'CAPITAL_PLAN'],
    portals: ['BONFIRE', 'OPENGOV', 'DEMANDSTAR', 'PLANETBIDS', 'IONWAVE', 'BIDNET', 'PUBLIC_PURCHASE', 'EUNA', 'AGENCY_NATIVE', 'OTHER'],
    signals: ['state procurement', 'solicitation', 'bid', 'rfp', 'rfq', 'ifb', 'award', 'budget', 'capital improvement'],
    requiredEvidence: ['official-domain', 'jurisdiction-owner', 'source-page'],
  },
  {
    id: 'LOCAL_PRIMARY',
    name: 'County and municipal procurement systems',
    priority: 'PRIMARY',
    levels: ['COUNTY', 'MUNICIPAL', 'SPECIAL_DISTRICT'],
    kinds: ['PROCUREMENT_PORTAL', 'AWARD_DATABASE', 'PUBLIC_NOTICE', 'MEETING_AGENDA', 'BUDGET', 'CAPITAL_PLAN', 'REGULATORY', 'LICENSING'],
    portals: ['BONFIRE', 'OPENGOV', 'DEMANDSTAR', 'PLANETBIDS', 'IONWAVE', 'BIDNET', 'PUBLIC_PURCHASE', 'EUNA', 'AGENCY_NATIVE', 'OTHER'],
    signals: ['purchasing', 'procurement', 'bid opportunities', 'solicitations', 'agenda', 'minutes', 'budget', 'capital plan', 'vendor registration', 'license', 'inspection'],
    requiredEvidence: ['official-domain', 'jurisdiction-owner', 'source-page', 'last-verified-at'],
    notes: 'A municipality may expose multiple procurement systems; never assume one portal per jurisdiction.',
  },
  {
    id: 'EDUCATION_PRIMARY',
    name: 'Education procurement',
    priority: 'PRIMARY',
    levels: ['SCHOOL_DISTRICT', 'UNIVERSITY'],
    kinds: ['PROCUREMENT_PORTAL', 'AWARD_DATABASE', 'PUBLIC_NOTICE', 'BUDGET', 'CAPITAL_PLAN'],
    portals: ['BONFIRE', 'OPENGOV', 'DEMANDSTAR', 'PLANETBIDS', 'IONWAVE', 'BIDNET', 'PUBLIC_PURCHASE', 'EUNA', 'AGENCY_NATIVE', 'OTHER'],
    signals: ['school district bids', 'university procurement', 'facilities', 'construction', 'supplies', 'food service', 'transportation'],
    requiredEvidence: ['official-domain', 'entity-type', 'source-page'],
  },
  {
    id: 'INFRASTRUCTURE_PRIMARY',
    name: 'Public infrastructure and authorities',
    priority: 'PRIMARY',
    levels: ['TRANSIT', 'AIRPORT', 'PORT', 'UTILITY', 'HOUSING_AUTHORITY', 'HEALTH_SYSTEM'],
    kinds: ['PROCUREMENT_PORTAL', 'AWARD_DATABASE', 'PUBLIC_NOTICE', 'MEETING_AGENDA', 'BUDGET', 'CAPITAL_PLAN', 'REGULATORY'],
    portals: ['BONFIRE', 'OPENGOV', 'DEMANDSTAR', 'PLANETBIDS', 'IONWAVE', 'BIDNET', 'PUBLIC_PURCHASE', 'EUNA', 'AGENCY_NATIVE', 'OTHER'],
    signals: ['capital project', 'maintenance', 'operations', 'construction', 'fleet', 'facilities', 'compliance', 'vendor opportunity'],
    requiredEvidence: ['official-domain', 'entity-type', 'source-page'],
  },
  {
    id: 'DISCOVERY_AGGREGATORS',
    name: 'Commercial and directory discovery sources',
    priority: 'DISCOVERY',
    levels: ['FEDERAL', 'STATE', 'COUNTY', 'MUNICIPAL', 'SCHOOL_DISTRICT', 'UNIVERSITY', 'TRANSIT', 'AIRPORT', 'PORT', 'UTILITY', 'HOUSING_AUTHORITY', 'HEALTH_SYSTEM', 'SPECIAL_DISTRICT', 'OTHER'],
    kinds: ['PROCUREMENT_PORTAL', 'PUBLIC_NOTICE', 'AWARD_DATABASE'],
    portals: ['OTHER'],
    signals: ['government bids', 'rfp', 'rfq', 'ifb', 'award', 'agency', 'county', 'city', 'school'],
    requiredEvidence: ['discovery-url', 'source-attribution', 'official-source-link'],
    notes: 'Use aggregators to discover candidates, then resolve and verify the authoritative government source.',
  },
]

export function rulesForGovernmentLevel(level: GovernmentLevel): GovernmentSourceDiscoveryRule[] {
  return GOVERNMENT_SOURCE_DISCOVERY_RULES.filter((rule) => rule.levels.includes(level))
}

export function rulesForSourceKind(kind: GovernmentSourceKind): GovernmentSourceDiscoveryRule[] {
  return GOVERNMENT_SOURCE_DISCOVERY_RULES.filter((rule) => rule.kinds.includes(kind))
}

export function portalCandidatesForLevel(level: GovernmentLevel): GovernmentPortal[] {
  return [...new Set(rulesForGovernmentLevel(level).flatMap((rule) => rule.portals))]
}
