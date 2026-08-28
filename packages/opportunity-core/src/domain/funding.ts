import type { OpportunitySourceClass } from './source.js'

export type FundingSourceCategory =
  | 'federal'
  | 'state'
  | 'local'
  | 'foundation'
  | 'corporate'
  | 'university'
  | 'accelerator'
  | 'association'
  | 'competition'
  | 'aggregator'
  | 'community'

export type FundingDiscoverySource = {
  id: string
  name: string
  category: FundingSourceCategory
  sourceClass: OpportunitySourceClass
  countryCodes: string[]
  official: boolean
  supports: Array<'grant' | 'contract' | 'prize' | 'tax_credit' | 'rebate' | 'subsidy' | 'loan' | 'investment' | 'accelerator' | 'in_kind'>
  discoveryMode: 'api' | 'feed' | 'crawl' | 'search' | 'manual'
  verificationRequired: boolean
}

export const FUNDING_SOURCE_CATEGORIES: readonly FundingSourceCategory[] = [
  'federal', 'state', 'local', 'foundation', 'corporate', 'university',
  'accelerator', 'association', 'competition', 'aggregator', 'community',
] as const

export const INITIAL_FUNDING_SOURCES: readonly FundingDiscoverySource[] = [
  {
    id: 'us.grants.gov',
    name: 'Grants.gov',
    category: 'federal',
    sourceClass: 'government',
    countryCodes: ['US'],
    official: true,
    supports: ['grant', 'cooperative_agreement'],
    discoveryMode: 'search',
    verificationRequired: true,
  },
  {
    id: 'us.sam.gov',
    name: 'SAM.gov',
    category: 'federal',
    sourceClass: 'government',
    countryCodes: ['US'],
    official: true,
    supports: ['contract'],
    discoveryMode: 'search',
    verificationRequired: true,
  },
  {
    id: 'us.helloskip',
    name: 'Hello Skip',
    category: 'aggregator',
    sourceClass: 'marketplace',
    countryCodes: ['US'],
    official: false,
    supports: ['grant', 'loan', 'credit'],
    discoveryMode: 'crawl',
    verificationRequired: true,
  },
]
