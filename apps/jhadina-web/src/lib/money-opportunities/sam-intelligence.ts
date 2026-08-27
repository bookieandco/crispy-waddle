import type { OpportunityScore, SamOpportunity } from './sam-types'

export interface CapabilityProfile {
  /** NAICS codes the business can credibly perform today. */
  naics?: string[]
  /** Plain-language capabilities used for lightweight keyword matching. */
  capabilities: string[]
  /** Maximum contract value the current team can reasonably execute without a partner. */
  maxSoloValue?: number
  /** Optional minimum target value. */
  minTargetValue?: number
}

const DEFAULT_PROFILE: CapabilityProfile = {
  capabilities: [
    'software development',
    'web application',
    'automation',
    'ai',
    'data analysis',
    'marketing',
    'content',
    'digital services',
    'research',
  ],
  maxSoloValue: 250000,
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'services', 'service'])

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

function capabilityScore(opportunity: SamOpportunity, profile: CapabilityProfile): number {
  if (profile.naics?.length && opportunity.naics) {
    const exact = profile.naics.some((code) => opportunity.naics === code || opportunity.naics.startsWith(code))
    if (exact) return 100
  }

  const haystack = tokens(`${opportunity.title} ${opportunity.description ?? ''}`).join(' ')
  const matches = profile.capabilities.flatMap((capability) => {
    const words = tokens(capability)
    return words.length && words.every((word) => haystack.includes(word)) ? [capability] : []
  })
  return Math.min(100, matches.length * 25)
}

function timingScore(opportunity: SamOpportunity): number {
  if (!opportunity.responseDeadline) return 55
  const deadline = Date.parse(opportunity.responseDeadline)
  if (!Number.isFinite(deadline)) return 45
  const days = (deadline - Date.now()) / 86400000
  if (days < 0) return 0
  if (days <= 3) return 25
  if (days <= 7) return 55
  if (days <= 21) return 85
  return 70
}

function valueScore(opportunity: SamOpportunity, profile: CapabilityProfile): number {
  const value = opportunity.estimatedValue
  if (!value) return 55
  if (profile.maxSoloValue && value > profile.maxSoloValue) return 45
  if (profile.minTargetValue && value < profile.minTargetValue) return 35
  if (value >= 25000 && value <= 250000) return 95
  if (value > 250000) return 80
  return 65
}

function competitionScore(opportunity: SamOpportunity): number {
  const setAside = (opportunity.setAside ?? '').toLowerCase()
  if (setAside && setAside !== 'none' && !setAside.includes('full')) return 90
  if (opportunity.noticeType === 'SOURCES_SOUGHT') return 60
  if (opportunity.noticeType === 'SOLICITATION') return 70
  return 50
}

function executionScore(opportunity: SamOpportunity, profile: CapabilityProfile, capability: number): number {
  const value = opportunity.estimatedValue ?? 0
  if (profile.maxSoloValue && value > profile.maxSoloValue) return Math.max(35, capability - 15)
  return Math.max(40, capability)
}

function partnerFitScore(opportunity: SamOpportunity, profile: CapabilityProfile, capability: number): number {
  const value = opportunity.estimatedValue ?? 0
  if (capability >= 50) return value > (profile.maxSoloValue ?? 250000) ? 90 : 65
  if (value > 100000) return 85
  return 35
}

export function scoreSamOpportunity(
  opportunity: SamOpportunity,
  profile: CapabilityProfile = DEFAULT_PROFILE,
): OpportunityScore {
  const capability = capabilityScore(opportunity, profile)
  const timing = timingScore(opportunity)
  const value = valueScore(opportunity, profile)
  const competition = competitionScore(opportunity)
  const execution = executionScore(opportunity, profile, capability)
  const partnerFit = partnerFitScore(opportunity, profile, capability)
  const total = Math.round(capability * 0.30 + timing * 0.10 + value * 0.20 + competition * 0.15 + execution * 0.15 + partnerFit * 0.10)

  const reasons: string[] = []
  if (capability >= 75) reasons.push('Strong match to current capabilities')
  else if (capability >= 50) reasons.push('Partial capability match')
  else reasons.push('Capability gap needs review')
  if (opportunity.setAside) reasons.push(`Set-aside: ${opportunity.setAside}`)
  if (opportunity.estimatedValue && profile.maxSoloValue && opportunity.estimatedValue > profile.maxSoloValue) {
    reasons.push('Value exceeds current solo execution ceiling; partner or subcontractor likely needed')
  }
  if (opportunity.noticeType === 'SOURCES_SOUGHT') reasons.push('Market-research notice; do not treat as an active award')
  if (opportunity.responseDeadline) reasons.push(`Response deadline: ${opportunity.responseDeadline}`)

  let disposition: OpportunityScore['disposition']
  if (capability >= 75 && total >= 75 && (!profile.maxSoloValue || (opportunity.estimatedValue ?? 0) <= profile.maxSoloValue)) {
    disposition = 'PURSUE'
  } else if (partnerFit >= 75 && total >= 60) {
    disposition = 'PARTNER'
  } else if (capability >= 50 || opportunity.noticeType === 'SOURCES_SOUGHT') {
    disposition = 'MONITOR'
  } else {
    disposition = 'PASS'
  }

  return { capability, timing, value, competition, execution, partnerFit, total, disposition, reasons }
}

export function scoreSamOpportunities(
  opportunities: SamOpportunity[],
  profile?: CapabilityProfile,
): Array<SamOpportunity & { intelligence: OpportunityScore }> {
  return opportunities
    .map((opportunity) => ({ ...opportunity, intelligence: scoreSamOpportunity(opportunity, profile) }))
    .sort((a, b) => b.intelligence.total - a.intelligence.total)
}
