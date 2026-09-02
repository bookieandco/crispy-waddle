import type { DiscoveredOpportunity, OpportunityDiscoveryProvider } from '../opportunity-discovery.js'
import { adaptGrantsGovOpportunity } from '../adapters/grants-gov.js'
import type { OpportunitySource } from '../domain/source.js'

const GRANTS_API_URL = 'https://api.simpler.grants.gov/v1/opportunities/search'

const GRANTS_SOURCE: OpportunitySource = {
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
}

type GrantsOpportunity = {
  opportunity_id?: string
  opportunity_number?: string
  opportunity_title?: string
  agency_code?: string
  agency_name?: string
  top_level_agency_name?: string
  post_date?: string
  close_date?: string
  opportunity_status?: string
  funding_instrument?: string
  funding_category?: string
  award_floor?: number
  award_ceiling?: number
  estimated_total_program_funding?: number
  expected_number_of_awards?: number
  applicant_types?: string[]
  summary?: string
  opportunity_url?: string
}

type GrantsResponse = {
  data?: GrantsOpportunity[]
  pagination_info?: {
    page_offset?: number
    page_size?: number
    total_pages?: number
    total_records?: number
  }
}

class GrantsGovProviderError extends Error {
  readonly code:
    | 'GRANTS_GOV_KEY_NOT_CONFIGURED'
    | 'GRANTS_GOV_REQUEST_FAILED'
    | 'GRANTS_GOV_INVALID_RESPONSE'
  readonly status?: number

  constructor(code: GrantsGovProviderError['code'], status?: number) {
    super(code)
    this.name = 'GrantsGovProviderError'
    this.code = code
    this.status = status
  }
}

function apiKey(): string {
  const key = process.env.SIMPLER_GRANTS_API_KEY?.trim() || process.env.simpler_grants_api_key?.trim()
  if (!key) throw new GrantsGovProviderError('GRANTS_GOV_KEY_NOT_CONFIGURED')
  return key
}

function pageSize(value?: number): number {
  return Math.min(Math.max(value ?? 25, 1), 100)
}

export type GrantsGovOpportunityDiscoveryProviderOptions = {
  fetchImpl?: typeof fetch
  limit?: number
  keyword?: string
  includeForecasted?: boolean
}

export class GrantsGovOpportunityDiscoveryProvider implements OpportunityDiscoveryProvider {
  readonly source = GRANTS_SOURCE

  constructor(private readonly options: GrantsGovOpportunityDiscoveryProviderOptions = {}) {}

  async discover(input?: { since?: string }): Promise<DiscoveredOpportunity[]> {
    const key = apiKey()
    const size = pageSize(this.options.limit)
    const filters: Record<string, unknown> = {
      opportunity_status: { one_of: this.options.includeForecasted === false ? ['posted'] : ['posted', 'forecasted'] },
    }
    if (input?.since) filters.post_date = { start_date: input.since }

    const payload = {
      ...(this.options.keyword ? { query: this.options.keyword } : {}),
      filters,
      pagination: {
        page_offset: 1,
        page_size: size,
        sort_order: [{ order_by: 'post_date', sort_direction: 'descending' }],
      },
    }

    let response: Response
    try {
      response = await (this.options.fetchImpl ?? fetch)(GRANTS_API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': key,
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      })
    } catch {
      throw new GrantsGovProviderError('GRANTS_GOV_REQUEST_FAILED')
    }

    if (!response.ok) throw new GrantsGovProviderError('GRANTS_GOV_REQUEST_FAILED', response.status)

    let result: GrantsResponse
    try {
      result = (await response.json()) as GrantsResponse
    } catch {
      throw new GrantsGovProviderError('GRANTS_GOV_INVALID_RESPONSE')
    }

    return (result.data ?? []).flatMap((opportunity): DiscoveredOpportunity[] => {
      if (!opportunity.opportunity_id || !opportunity.opportunity_title) return []

      return [{
        externalId: opportunity.opportunity_id,
        source: GRANTS_SOURCE,
        opportunity: adaptGrantsGovOpportunity({
          opportunityId: opportunity.opportunity_id,
          opportunityNumber: opportunity.opportunity_number,
          opportunityTitle: opportunity.opportunity_title,
          agencyCode: opportunity.agency_code,
          agencyName: opportunity.agency_name,
          topLevelAgencyName: opportunity.top_level_agency_name,
          postDate: opportunity.post_date,
          closeDate: opportunity.close_date,
          opportunityStatus: opportunity.opportunity_status,
          fundingInstrument: opportunity.funding_instrument,
          fundingCategory: opportunity.funding_category,
          awardFloor: opportunity.award_floor,
          awardCeiling: opportunity.award_ceiling,
          estimatedTotalProgramFunding: opportunity.estimated_total_program_funding,
          expectedNumberOfAwards: opportunity.expected_number_of_awards,
          applicantTypes: opportunity.applicant_types,
          summary: opportunity.summary,
          opportunityUrl: opportunity.opportunity_url,
        }),
      }]
    })
  }
}

export { GrantsGovProviderError }
