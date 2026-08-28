export type OpportunitySourceClass =
  | 'government'
  | 'foundation'
  | 'corporate'
  | 'university'
  | 'accelerator'
  | 'association'
  | 'competition'
  | 'marketplace'
  | 'media'
  | 'user'
  | 'other'

export type OpportunitySourceAuthority = 'official' | 'secondary' | 'community' | 'user'

export type OpportunitySource = {
  id: string
  name: string
  publisher: string
  class: OpportunitySourceClass
  authority: OpportunitySourceAuthority
  countryCodes: string[]
  opportunityTypes: string[]
  officialUrl: string
  adapterKey?: string
  refreshPolicy?: 'manual' | 'daily' | 'weekly' | 'event_driven'
  active: boolean
}

export const CANONICAL_OPPORTUNITY_SOURCES: readonly OpportunitySource[] = [
  {
    id: 'us.grants.gov',
    name: 'Grants.gov',
    publisher: 'U.S. Government',
    class: 'government',
    authority: 'official',
    countryCodes: ['US'],
    opportunityTypes: ['grant', 'cooperative_agreement'],
    officialUrl: 'https://www.grants.gov/',
    adapterKey: 'grants.gov',
    refreshPolicy: 'daily',
    active: true,
  },
  {
    id: 'us.sam.gov',
    name: 'SAM.gov Contract Opportunities',
    publisher: 'U.S. Government',
    class: 'government',
    authority: 'official',
    countryCodes: ['US'],
    opportunityTypes: ['contract'],
    officialUrl: 'https://sam.gov/content/opportunities',
    adapterKey: 'sam.gov',
    refreshPolicy: 'daily',
    active: true,
  },
  {
    id: 'ca.canada-grants-funding',
    name: 'Government of Canada Grants and Funding',
    publisher: 'Government of Canada',
    class: 'government',
    authority: 'official',
    countryCodes: ['CA'],
    opportunityTypes: ['grant', 'subsidy', 'loan'],
    officialUrl: 'https://www.canada.ca/en/government/grants-funding.html',
    adapterKey: 'canada.grants-funding',
    refreshPolicy: 'daily',
    active: true,
  },
  {
    id: 'gb.find-a-grant',
    name: 'Find a Grant',
    publisher: 'UK Government',
    class: 'government',
    authority: 'official',
    countryCodes: ['GB'],
    opportunityTypes: ['grant'],
    officialUrl: 'https://www.find-government-grants.service.gov.uk/',
    adapterKey: 'uk.find-a-grant',
    refreshPolicy: 'daily',
    active: true,
  },
  {
    id: 'au.grantconnect',
    name: 'GrantConnect',
    publisher: 'Australian Government',
    class: 'government',
    authority: 'official',
    countryCodes: ['AU'],
    opportunityTypes: ['grant'],
    officialUrl: 'https://www.grants.gov.au/',
    adapterKey: 'australia.grantconnect',
    refreshPolicy: 'daily',
    active: true,
  },
  {
    id: 'nz.funding-explorer',
    name: 'Funding Explorer',
    publisher: 'New Zealand Government',
    class: 'government',
    authority: 'official',
    countryCodes: ['NZ'],
    opportunityTypes: ['grant', 'subsidy', 'loan'],
    officialUrl: 'https://www.business.govt.nz/browse-our-resource-library/funding-explorer',
    adapterKey: 'nz.funding-explorer',
    refreshPolicy: 'weekly',
    active: true,
  },
  {
    id: 'eu.funding-tenders',
    name: 'EU Funding & Tenders Portal',
    publisher: 'European Union',
    class: 'government',
    authority: 'official',
    countryCodes: ['EU'],
    opportunityTypes: ['grant', 'prize', 'contract'],
    officialUrl: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/',
    adapterKey: 'eu.funding-tenders',
    refreshPolicy: 'daily',
    active: true,
  },
] as const
