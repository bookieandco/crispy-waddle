import type { GovernmentPortal, GovernmentSource } from './source-registry'

export type GovernmentSourceTier = 'AUTHORITATIVE' | 'COOPERATIVE' | 'AGGREGATOR' | 'DISCOVERY'

export interface CooperativePurchasingSource {
  id: string
  name: string
  tier: GovernmentSourceTier
  portal?: GovernmentPortal
  officialUrl: string
  coverage: string[]
  entityLevels: string[]
  opportunityKinds: string[]
  notes: string[]
}

/**
 * Cooperative purchasing is a distinct demand surface: an existing competitively
 * awarded contract can expose repeatable government spend without a new local RFP.
 */
export const COOPERATIVE_PURCHASING_SOURCES: CooperativePurchasingSource[] = [
  {
    id: 'naspo-valuepoint',
    name: 'NASPO ValuePoint',
    tier: 'COOPERATIVE',
    officialUrl: 'https://www.naspovaluepoint.org/',
    coverage: ['MULTI_STATE', 'NATIONAL'],
    entityLevels: ['STATE', 'COUNTY', 'MUNICIPAL', 'SCHOOL_DISTRICT', 'UNIVERSITY', 'SPECIAL_DISTRICT'],
    opportunityKinds: ['COOPERATIVE_CONTRACT', 'SOLICITATION', 'MASTER_AGREEMENT'],
    notes: ['Tracks multi-state cooperative solicitations and awarded master agreements.'],
  },
  {
    id: 'hgacbuy',
    name: 'HGACBuy',
    tier: 'COOPERATIVE',
    officialUrl: 'https://www.hgacbuy.org/',
    coverage: ['NATIONAL'],
    entityLevels: ['STATE', 'COUNTY', 'MUNICIPAL', 'SCHOOL_DISTRICT', 'SPECIAL_DISTRICT', 'OTHER'],
    opportunityKinds: ['COOPERATIVE_CONTRACT', 'SOLICITATION', 'BLANKET_CONTRACT'],
    notes: ['Nationwide government-to-government cooperative purchasing program.', 'Contracts are competitively procured and commonly run for two or three years.'],
  },
  {
    id: 'cooperative-purchasing-generic',
    name: 'Other Cooperative Purchasing Program',
    tier: 'DISCOVERY',
    officialUrl: '',
    coverage: ['STATE', 'REGIONAL', 'NATIONAL'],
    entityLevels: ['STATE', 'COUNTY', 'MUNICIPAL', 'SCHOOL_DISTRICT', 'UNIVERSITY', 'SPECIAL_DISTRICT'],
    opportunityKinds: ['COOPERATIVE_CONTRACT', 'MASTER_AGREEMENT'],
    notes: ['Placeholder for state and regional cooperatives discovered through jurisdiction source mapping.'],
  },
]

export function cooperativeSourceIds(): string[] {
  return COOPERATIVE_PURCHASING_SOURCES.map((source) => source.id)
}

export function toGovernmentSource(
  source: CooperativePurchasingSource,
  entityId: string,
  entity: GovernmentSource['entity'],
): GovernmentSource {
  return {
    id: `coop:${source.id}:${entityId}`,
    entityId,
    entity,
    kind: 'PROCUREMENT_PORTAL',
    portal: source.portal ?? 'OTHER',
    url: source.officialUrl,
    official: source.tier !== 'AGGREGATOR' && source.tier !== 'DISCOVERY',
    active: true,
    capabilities: source.opportunityKinds,
    discoverySignals: source.coverage,
  }
}
