import type { Opportunity } from '@/lib/opportunities/sideIncome'

export type SamNotice = Record<string, unknown>

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstText(...values: unknown[]): string {
  return values.map(text).find(Boolean) ?? ''
}

function number(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,]/g, ''))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function inferPay(notice: SamNotice): Opportunity['estimatedPay'] {
  const max = number(notice.awardCeiling) ?? number(notice.baseAndAllOptionsValue) ?? number(notice.baseAndAllOptionsValueSupplied)
  const min = number(notice.awardFloor) ?? number(notice.baseAndAllOptionsValue)
  if (max === undefined && min === undefined) return undefined
  return { min, max, currency: 'USD', cadence: 'per_project' }
}

function scoreNotice(notice: SamNotice): { fitScore: number; riskFlags: string[]; automationLevel: Opportunity['automationLevel'] } {
  const title = firstText(notice.title, notice.description, notice.subject).toLowerCase()
  const setAside = firstText(notice.typeOfSetAside, notice.typeOfSetAsideDescription).toLowerCase()
  const flags: string[] = []
  let score = 35

  if (setAside) score += 15
  if (/small business|8\(a\)|hubzone|woman|veteran|service-disabled/.test(setAside)) score += 10
  if (/solicitation|combined synopsis|award notice/.test(title)) score += 15
  if (/sources sought|request for information|rfi|market research/.test(title)) score -= 5
  if (/construction|weapons|ammunition|classified|security clearance/.test(title)) flags.push('specialized_or_restricted')
  if (/sole source|brand name|proprietary/.test(title)) flags.push('restricted_competition')
  if (/sources sought|request for information|market research/.test(title)) flags.push('market_research_not_award')

  const automationLevel: Opportunity['automationLevel'] = flags.includes('specialized_or_restricted')
    ? 'user_led'
    : 'ai_plus_user'

  return { fitScore: Math.max(0, Math.min(100, score)), riskFlags: flags, automationLevel }
}

export function adaptSamNotice(notice: SamNotice, userId = 'default'): Opportunity {
  const { fitScore, riskFlags, automationLevel } = scoreNotice(notice)
  const title = firstText(notice.title, notice.subject, 'SAM.gov opportunity')
  const noticeId = firstText(notice.noticeId, notice.solicitationNumber, notice.contractOpportunityId) || crypto.randomUUID()
  const sourceUrl = firstText(notice.uiLink, notice.url, notice.link) || `https://sam.gov/opp/${noticeId}/view`
  const summary = firstText(notice.description, notice.title, 'Government contract opportunity discovered on SAM.gov')

  return {
    id: `sam_${noticeId}`,
    userId,
    title,
    kind: 'automation',
    sourceUrl,
    sourceName: 'SAM.gov',
    summary: summary.slice(0, 1200),
    estimatedPay: inferPay(notice),
    automationLevel,
    fitScore,
    riskFlags,
    deadline: firstText(notice.responseDeadLine, notice.responseDeadline, notice.archiveDate) || undefined,
    requiresUserApproval: true,
    verificationStatus: 'human_required',
    sourceConfidence: 0.95,
    status: 'new',
    createdAt: new Date().toISOString(),
  }
}

export function adaptSamResults(data: unknown, userId = 'default'): Opportunity[] {
  const root = (data && typeof data === 'object') ? data as Record<string, unknown> : {}
  const raw = Array.isArray(root.opportunities) ? root.opportunities
    : Array.isArray(root.results) ? root.results
    : Array.isArray(data) ? data
    : []

  return raw
    .filter((item): item is SamNotice => Boolean(item && typeof item === 'object'))
    .map((item) => adaptSamNotice(item, userId))
}
