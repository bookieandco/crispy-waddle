import {
  adaptSamOpportunity,
  type OpportunityDiscoveryProvider,
  type DiscoveredOpportunity,
  type OpportunitySource,
} from '@jhadina/opportunity-core'
import { searchSamOpportunities } from '../money-opportunities/sam-client'

export type SamDiscoveryOptions = {
  limit?: number
  offset?: number
  keyword?: string
  noticeType?: string
  typeOfSetAside?: string
  postedFrom?: string
  postedTo?: string
}

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

const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined
const number = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,]/g, ''))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}
const first = (...values: unknown[]) => values.map(text).find(Boolean)

function samDate(value?: string): string | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${month}/${day}/${parsed.getUTCFullYear()}`
}

function noticeToInput(notice: Record<string, unknown>, fetchedAt: string) {
  const noticeId = first(notice.noticeId, notice.solicitationNumber, notice.contractOpportunityId)
  if (!noticeId) throw new Error('SAM.gov notice is missing a stable notice identifier')
  const title = first(notice.title, notice.subject, notice.description)
  if (!title) throw new Error(`SAM.gov notice ${noticeId} is missing a title`)

  return {
    noticeId,
    title,
    noticeType: first(notice.type, notice.noticeType, notice.contractOpportunityType),
    solicitationNumber: first(notice.solicitationNumber),
    department: first(notice.department, notice.departmentName),
    office: first(notice.office, notice.officeName),
    naicsCode: first(notice.naicsCode, notice.naics),
    setAside: first(notice.typeOfSetAside, notice.typeOfSetAsideDescription),
    responseDeadline: first(notice.responseDeadLine, notice.responseDeadline, notice.archiveDate),
    estimatedValue: number(notice.awardCeiling) ?? number(notice.baseAndAllOptionsValue) ?? number(notice.baseAndAllOptionsValueSupplied),
    placeOfPerformance: first(notice.placeOfPerformance, notice.placeOfPerformanceCity, notice.placeOfPerformanceState),
    description: first(notice.description, notice.title),
    sourceUrl: first(notice.uiLink, notice.url, notice.link) ?? `https://sam.gov/opp/${noticeId}/view`,
    fetchedAt,
  }
}

export class SamOpportunityDiscoveryProvider implements OpportunityDiscoveryProvider {
  readonly source = SAM_SOURCE

  constructor(private readonly defaults: SamDiscoveryOptions = {}) {}

  async discover(input?: { since?: string }): Promise<DiscoveredOpportunity[]> {
    const fetchedAt = new Date().toISOString()
    const data = await searchSamOpportunities({
      limit: this.defaults.limit ?? 25,
      offset: this.defaults.offset ?? 0,
      keyword: this.defaults.keyword,
      noticeType: this.defaults.noticeType,
      typeOfSetAside: this.defaults.typeOfSetAside,
      postedFrom: samDate(input?.since ?? this.defaults.postedFrom),
      postedTo: samDate(this.defaults.postedTo),
    })

    const root = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    const raw = Array.isArray(root.opportunities) ? root.opportunities
      : Array.isArray(root.results) ? root.results
      : Array.isArray(data) ? data
      : []

    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((notice) => {
        const canonical = adaptSamOpportunity(noticeToInput(notice, fetchedAt))
        return { opportunity: canonical, source: SAM_SOURCE, externalId: canonical.id }
      })
  }
}

export { SAM_SOURCE }
