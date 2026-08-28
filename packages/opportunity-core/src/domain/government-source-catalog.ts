export type GovernmentMoneySurface =
  | 'contract_opportunity'
  | 'contract_forecast'
  | 'contract_award'
  | 'subcontract'
  | 'grant'
  | 'loan'
  | 'tax_incentive'
  | 'regulatory_requirement'
  | 'cooperative_purchasing'
  | 'surplus_asset'

export type GovernmentSourceTier = 'authoritative' | 'discovery' | 'commercial'

export type GovernmentSourceDefinition = {
  id: string
  name: string
  publisher: string
  tier: GovernmentSourceTier
  surfaces: readonly GovernmentMoneySurface[]
  countryCodes: readonly string[]
  officialUrl: string
  geography: 'federal' | 'state' | 'local' | 'national' | 'international'
  notes?: string
}

/**
 * Seed registry for the government-money radar.
 *
 * This is intentionally metadata-only: adapters are responsible for retrieval,
 * normalization and evidence capture. Commercial/discovery sources must never
 * be treated as authoritative evidence without corroboration.
 */
export const GOVERNMENT_MONEY_SOURCES: readonly GovernmentSourceDefinition[] = [
  {
    id: 'us.sam.opportunities',
    name: 'SAM.gov Contract Opportunities',
    publisher: 'U.S. Government',
    tier: 'authoritative',
    surfaces: ['contract_opportunity'],
    countryCodes: ['US'],
    officialUrl: 'https://sam.gov/opportunities',
    geography: 'federal',
    notes: 'Federal pre-solicitations, solicitations, awards and sole-source notices.',
  },
  {
    id: 'us.sam.contract-data',
    name: 'SAM.gov Contract Data',
    publisher: 'U.S. Government',
    tier: 'authoritative',
    surfaces: ['contract_award', 'contract_forecast'],
    countryCodes: ['US'],
    officialUrl: 'https://sam.gov/contract-data',
    geography: 'federal',
    notes: 'Federal award history and searchable contracting data.',
  },
  {
    id: 'us.sba.subnet',
    name: 'SBA SUBNet',
    publisher: 'U.S. Small Business Administration',
    tier: 'authoritative',
    surfaces: ['subcontract'],
    countryCodes: ['US'],
    officialUrl: 'https://www.sba.gov/subnet',
    geography: 'federal',
    notes: 'Small-business subcontracting notices posted by federal prime contractors.',
  },
  {
    id: 'us.sba.sbs',
    name: 'SBA Small Business Search',
    publisher: 'U.S. Small Business Administration',
    tier: 'authoritative',
    surfaces: ['subcontract', 'contract_opportunity'],
    countryCodes: ['US'],
    officialUrl: 'https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting',
    geography: 'federal',
    notes: 'Provider discovery for government market research and teaming.',
  },
  {
    id: 'us.grants.gov',
    name: 'Grants.gov',
    publisher: 'U.S. Government',
    tier: 'authoritative',
    surfaces: ['grant', 'cooperative_purchasing'],
    countryCodes: ['US'],
    officialUrl: 'https://www.grants.gov/',
    geography: 'federal',
  },
  {
    id: 'us.usaspending',
    name: 'USAspending.gov',
    publisher: 'U.S. Government',
    tier: 'authoritative',
    surfaces: ['contract_award', 'grant'],
    countryCodes: ['US'],
    officialUrl: 'https://www.usaspending.gov/',
    geography: 'federal',
    notes: 'Historical federal awards and recipient/agency spending intelligence.',
  },
  {
    id: 'us.gsa.forecasts',
    name: 'GSA Federal Agency Business Forecasts',
    publisher: 'U.S. General Services Administration',
    tier: 'authoritative',
    surfaces: ['contract_forecast'],
    countryCodes: ['US'],
    officialUrl: 'https://www.gsa.gov/small-business/find-opportunities',
    geography: 'federal',
  },
  {
    id: 'us.naspo.valuepoint',
    name: 'NASPO ValuePoint',
    publisher: 'NASPO',
    tier: 'authoritative',
    surfaces: ['cooperative_purchasing'],
    countryCodes: ['US'],
    officialUrl: 'https://www.naspo.org/our-work/valuepoint/',
    geography: 'national',
    notes: 'Cooperative purchasing contracts used by participating public entities.',
  },
  {
    id: 'us.hgacbuy',
    name: 'HGACBuy',
    publisher: 'Houston-Galveston Area Council',
    tier: 'authoritative',
    surfaces: ['cooperative_purchasing'],
    countryCodes: ['US'],
    officialUrl: 'https://www.hgacbuy.org/',
    geography: 'national',
    notes: 'Cooperative purchasing contracts available to participating public agencies.',
  },
  {
    id: 'us.findrfp',
    name: 'FindRFP',
    publisher: 'FindRFP',
    tier: 'discovery',
    surfaces: ['contract_opportunity', 'contract_forecast', 'contract_award'],
    countryCodes: ['US'],
    officialUrl: 'https://www.findrfp.com/',
    geography: 'national',
    notes: 'Aggregator used for source discovery; corroborate with the issuing agency.',
  },
  {
    id: 'us.samsearch',
    name: 'SAMSearch',
    publisher: 'SAMSearch',
    tier: 'discovery',
    surfaces: ['contract_opportunity', 'contract_forecast', 'subcontract', 'grant'],
    countryCodes: ['US'],
    officialUrl: 'https://samsearch.co/',
    geography: 'national',
    notes: 'Aggregator/discovery layer; not authoritative evidence.',
  },
  {
    id: 'us.ptai',
    name: 'PTAI Government Contracting Website Guide',
    publisher: 'PTAI',
    tier: 'discovery',
    surfaces: ['contract_opportunity'],
    countryCodes: ['US'],
    officialUrl: 'https://www.ptai.net/best-government-contracting-websites/',
    geography: 'national',
    notes: 'Directory useful for discovering jurisdiction-specific procurement sources.',
  },
]

export function getGovernmentMoneySources(
  surface?: GovernmentMoneySurface,
): readonly GovernmentSourceDefinition[] {
  if (!surface) return GOVERNMENT_MONEY_SOURCES
  return GOVERNMENT_MONEY_SOURCES.filter((source) => source.surfaces.includes(surface))
}
