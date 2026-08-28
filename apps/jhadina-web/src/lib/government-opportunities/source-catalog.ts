import type { GovernmentPortal, GovernmentSourceKind } from './source-registry'

export type GovernmentSourceTier = 'AUTHORITATIVE' | 'AGGREGATOR' | 'DISCOVERY'

export interface GovernmentSourceCatalogEntry {
  id: string
  name: string
  tier: GovernmentSourceTier
  kind: GovernmentSourceKind
  portal?: GovernmentPortal
  scope: 'FEDERAL' | 'STATE' | 'LOCAL' | 'MULTI_LEVEL'
  entityTypes: string[]
  capabilities: string[]
  official: boolean
  notes?: string
}

/**
 * Curated discovery catalog. This is metadata only: adapters must resolve
 * opportunities to authoritative evidence before they enter the canonical
 * Opportunity pipeline.
 */
export const GOVERNMENT_SOURCE_CATALOG: GovernmentSourceCatalogEntry[] = [
  {
    id: 'sam-gov', name: 'SAM.gov Contract Opportunities', tier: 'AUTHORITATIVE',
    kind: 'PROCUREMENT_PORTAL', portal: 'SAM_GOV', scope: 'FEDERAL',
    entityTypes: ['FEDERAL_AGENCY'], capabilities: ['SOLICITATIONS', 'PRE_SOLICITATIONS', 'SOURCES_SOUGHT', 'AWARDS'], official: true,
  },
  {
    id: 'usaspending', name: 'USAspending.gov', tier: 'AUTHORITATIVE',
    kind: 'AWARD_DATABASE', portal: 'USA_SPENDING', scope: 'FEDERAL',
    entityTypes: ['FEDERAL_AGENCY'], capabilities: ['AWARDS', 'SPEND_HISTORY', 'RECIPIENTS', 'NAICS', 'AGENCY_HISTORY'], official: true,
  },
  {
    id: 'sba-subnet', name: 'SBA SUBNet', tier: 'AUTHORITATIVE',
    kind: 'SUBCONTRACTING', portal: 'SBA_SUBNET', scope: 'FEDERAL',
    entityTypes: ['FEDERAL_AGENCY', 'PRIME_CONTRACTOR'], capabilities: ['SUBCONTRACTS', 'PARTNER_DISCOVERY'], official: true,
  },
  {
    id: 'gsa-forecast', name: 'GSA / Agency Procurement Forecasts', tier: 'AUTHORITATIVE',
    kind: 'FORECAST', portal: 'GSA_FORECAST', scope: 'FEDERAL',
    entityTypes: ['FEDERAL_AGENCY'], capabilities: ['FORECASTS', 'PRE_SOLICITATION_SIGNAL'], official: true,
  },
  {
    id: 'findrfp', name: 'FindRFP', tier: 'AGGREGATOR', kind: 'PROCUREMENT_PORTAL', scope: 'MULTI_LEVEL',
    entityTypes: ['STATE', 'COUNTY', 'MUNICIPAL', 'SCHOOL_DISTRICT', 'UNIVERSITY', 'HOSPITAL', 'AIRPORT', 'UTILITY'],
    capabilities: ['RFP', 'RFI', 'RFQ', 'AWARDS', 'AUCTIONS', 'INDUSTRY_TAXONOMY', 'STATE_COVERAGE'], official: false,
    notes: 'Discovery and taxonomy source; resolve results to the issuing agency before pursuit.',
  },
  {
    id: 'samsearch', name: 'SamSearch', tier: 'AGGREGATOR', kind: 'PROCUREMENT_PORTAL', scope: 'MULTI_LEVEL',
    entityTypes: ['FEDERAL_AGENCY', 'STATE', 'COUNTY', 'MUNICIPAL', 'EDUCATION'],
    capabilities: ['OPPORTUNITY_DISCOVERY', 'FORECASTS', 'NATURAL_LANGUAGE_SEARCH'], official: false,
    notes: 'Use as discovery coverage, not as final evidence.',
  },
  {
    id: 'ptai-contracting-sites', name: 'PTAI Government Contracting Website Directory', tier: 'DISCOVERY', kind: 'PUBLIC_NOTICE', scope: 'MULTI_LEVEL',
    entityTypes: ['FEDERAL_AGENCY', 'STATE', 'COUNTY', 'MUNICIPAL', 'EDUCATION'],
    capabilities: ['SOURCE_DISCOVERY'], official: false,
    notes: 'Directory used to discover additional procurement sources.',
  },
]

export function listGovernmentSourceCatalog(filters: {
  tier?: GovernmentSourceTier
  scope?: GovernmentSourceCatalogEntry['scope']
  kind?: GovernmentSourceKind
} = {}): GovernmentSourceCatalogEntry[] {
  return GOVERNMENT_SOURCE_CATALOG.filter((entry) => {
    if (filters.tier && entry.tier !== filters.tier) return false
    if (filters.scope && entry.scope !== filters.scope) return false
    if (filters.kind && entry.kind !== filters.kind) return false
    return true
  })
}
