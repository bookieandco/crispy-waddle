import type { DiscoveredOpportunity, OpportunityDiscoveryProvider } from '../opportunity-discovery.js'
import { adaptSamOpportunity } from '../adapters/sam.js'
import type { OpportunitySource } from '../domain/source.js'

const SAM_API_URL = 'https://api.sam.gov/opportunities/v2/search'

const SAM_SOURCE: OpportunitySource = {
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
}

type SamNotice = {
  noticeId?: string
  title?: string
  noticeType?: string
  solicitationNumber?: string
  department?: string
  office?: string
  naicsCode?: string
  typeOfSetAside?: string
  setAside?: string
  responseDeadLine?: string
  estimatedValue?: number | string
  placeOfPerformance?: string | { city?: string; state?: string; zip?: string; country?: string }
  description?: string
  uiLink?: string
  resourceLinks?: string[]
}

type SamResponse = {
  opportunitiesData?: SamNotice[]
  totalRecords?: number
  limit?: number
  offset?: number
}

function apiKey(): string {
  const key = process.env.SAM_GOV_API_KEY?.trim() || process.env.sam_key?.trim()
  if (!key) throw new Error('SAM.gov API key is not configured')
  return key
}

function placeOfPerformance(value: SamNotice['placeOfPerformance']): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return [value.city, value.state, value.zip, value.country].filter(Boolean).join(', ') || undefined
}

function estimatedValue(value: SamNotice['estimatedValue']): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,]/g, ''))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function noticeUrl(notice: SamNotice): string {
  return notice.uiLink || (notice.noticeId ? `https://sam.gov/opp/${encodeURIComponent(notice.noticeId)}/view` : SAM_SOURCE.officialUrl)
}

export type SamOpportunityDiscoveryProviderOptions = {
  fetchImpl?: typeof fetch
  limit?: number
  keyword?: string
  noticeType?: string
  typeOfSetAside?: string
}

export class SamOpportunityDiscoveryProvider implements OpportunityDiscoveryProvider {
  readonly source = SAM_SOURCE

  constructor(private readonly options: SamOpportunityDiscoveryProviderOptions = {}) {}

  async discover(input?: { since?: string }): Promise<DiscoveredOpportunity[]> {
    const url = new URL(SAM_API_URL)
    url.searchParams.set('api_key', apiKey())
    url.searchParams.set('limit', String(Math.min(Math.max(this.options.limit ?? 25, 1), 100)))
    url.searchParams.set('offset', '0')
    if (input?.since) url.searchParams.set('postedFrom', input.since)
    if (this.options.keyword) url.searchParams.set('q', this.options.keyword)
    if (this.options.noticeType) url.searchParams.set('ptype', this.options.noticeType)
    if (this.options.typeOfSetAside) url.searchParams.set('typeOfSetAside', this.options.typeOfSetAside)

    const response = await (this.options.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`SAM.gov request failed (${response.status}): ${detail.slice(0, 500)}`)
    }

    const payload = (await response.json()) as SamResponse
    return (payload.opportunitiesData ?? []).flatMap((notice): DiscoveredOpportunity[] => {
      if (!notice.noticeId || !notice.title) return []
      return [{
        externalId: notice.noticeId,
        source: SAM_SOURCE,
        opportunity: adaptSamOpportunity({
          noticeId: notice.noticeId,
          title: notice.title,
          noticeType: notice.noticeType,
          solicitationNumber: notice.solicitationNumber,
          department: notice.department,
          office: notice.office,
          naicsCode: notice.naicsCode,
          setAside: notice.setAside || notice.typeOfSetAside,
          responseDeadline: notice.responseDeadLine,
          estimatedValue: estimatedValue(notice.estimatedValue),
          placeOfPerformance: placeOfPerformance(notice.placeOfPerformance),
          description: notice.description,
          sourceUrl: noticeUrl(notice),
        }),
      }]
    })
  }
}
