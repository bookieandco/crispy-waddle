import type { VentureWorkItem } from './venture-factory.js'

/**
 * BUSINESS-GROWTH-GAME.01: evidence-to-mission planner, NOT a publisher.
 * Nothing here grants CMS, social, outreach, spending, or payment authority.
 */
export type GrowthEvidenceKind =
  | 'search_console' | 'site_audit' | 'analytics'
  | 'commerce_settlement' | 'market_research' | 'community' | 'manual'

export type GrowthEvidence = {
  ref: string
  kind: GrowthEvidenceKind
  observedAt: string
  verified: boolean
}

export type GrowthIntent = 'transactional' | 'commercial' | 'informational'
export type GrowthIssue = 'technical' | 'conversion' | 'community' | 'repurpose' | 'content'
export type GrowthOpportunitySignal = {
  id: string
  query: string
  intent: GrowthIntent
  existingPageUrl?: string
  impressions?: number
  clicks?: number
  conversions?: number
  issue?: GrowthIssue
  originalValue?: boolean
  evidenceRefs: string[]
}

export type BusinessGrowthSnapshot = {
  ventureId: string
  businessId: string
  siteUrl: string
  observedAt: string
  evidence: GrowthEvidence[]
  signals: GrowthOpportunitySignal[]
}

export type GrowthMissionKind =
  | 'measure_baseline' | 'repair_site' | 'improve_conversion'
  | 'refresh_page' | 'create_page' | 'community_research' | 'social_repurpose'
export type GrowthMissionStatus = 'review_ready' | 'evidence_blocked'
export type BusinessGrowthMission = {
  id: string
  ventureId: string
  businessId: string
  kind: GrowthMissionKind
  title: string
  stage: 'SCOUT' | 'FIX' | 'CREATE' | 'AMPLIFY'
  score: number
  status: GrowthMissionStatus
  blockers: string[]
  evidenceRefs: string[]
  sourceSignalId?: string
  goal: 'verified_contribution'
  proposedXp: number
  earnedXp: 0
  requiresApproval: true
  authorizationEffect: 'NONE'
  externalActionAuthorized: false
}
export type BusinessGrowthDeck = {
  missions: BusinessGrowthMission[]
  workItems: VentureWorkItem[]
  totalEarnedXp: 0
  evidenceBackedOutcomes: 0
}

function required(value: string, name: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('GROWTH_MISSION_' + name + '_REQUIRED')
  return trimmed
}
function isoTime(value: string): number {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error('GROWTH_MISSION_TIMESTAMP_INVALID')
  return time
}
function nonnegative(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error('GROWTH_MISSION_' + name + '_INVALID')
  }
}
function siteHost(url: string): string {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error('INVALID')
    return parsed.hostname.toLowerCase()
  } catch {
    throw new Error('GROWTH_MISSION_SITE_URL_INVALID')
  }
}
function unique(refs: string[]): string[] {
  return [...new Set(refs.map(ref => ref.trim()).filter(Boolean))]
}
function hasOwnedEvidence(refs: string[], evidence: Map<string, GrowthEvidence>, kind: GrowthEvidenceKind): boolean {
  return refs.some(ref => {
    const item = evidence.get(ref)
    return item?.kind === kind && item.verified
  })
}
function chooseKind(signal: GrowthOpportunitySignal): GrowthMissionKind | null {
  if (signal.issue === 'technical') return 'repair_site'
  if (signal.issue === 'community') return 'community_research'
  if (signal.issue === 'repurpose') return 'social_repurpose'
  if (signal.issue === 'conversion') return 'improve_conversion'
  if (signal.existingPageUrl) {
    if ((signal.clicks ?? 0) >= 25 && signal.conversions === 0) return 'improve_conversion'
    return 'refresh_page'
  }
  // Never turn an information-only keyword into a mass-content quota.
  if (signal.intent === 'informational' && !signal.originalValue) return null
  return 'create_page'
}
const MISSION_META: Record<GrowthMissionKind, { title: string; stage: BusinessGrowthMission['stage']; xp: number }> = {
  measure_baseline: { title: 'Connect and verify first-party search baseline', stage: 'SCOUT', xp: 10 },
  repair_site: { title: 'Repair technical discoverability', stage: 'FIX', xp: 25 },
  improve_conversion: { title: 'Improve buyer conversion on existing page', stage: 'FIX', xp: 35 },
  refresh_page: { title: 'Improve an existing page before creating another', stage: 'FIX', xp: 25 },
  create_page: { title: 'Research a high-intent page with original value', stage: 'CREATE', xp: 30 },
  community_research: { title: 'Review a relevant community discussion', stage: 'SCOUT', xp: 15 },
  social_repurpose: { title: 'Prepare platform-native social drafts from approved content', stage: 'AMPLIFY', xp: 20 },
}

export function buildBusinessGrowthMissionDeck(snapshot: BusinessGrowthSnapshot): BusinessGrowthDeck {
  const ventureId = required(snapshot.ventureId, 'VENTURE')
  const businessId = required(snapshot.businessId, 'BUSINESS')
  const host = siteHost(snapshot.siteUrl)
  const now = isoTime(snapshot.observedAt)
  const evidence = new Map<string, GrowthEvidence>()
  for (const item of snapshot.evidence) {
    const ref = required(item.ref, 'EVIDENCE_REF')
    const date = isoTime(item.observedAt)
    if (date > now) throw new Error('GROWTH_MISSION_FUTURE_EVIDENCE')
    if (item.kind === 'manual' && item.verified) throw new Error('GROWTH_MISSION_MANUAL_CANNOT_VERIFY')
    if (evidence.has(ref)) throw new Error('GROWTH_MISSION_DUPLICATE_EVIDENCE')
    evidence.set(ref, item)
  }
  const hasSearchBaseline = [...evidence.values()].some(item =>
    item.kind === 'search_console' && item.verified && (now - isoTime(item.observedAt)) <= 90 * 86400000
  )
  const missions: BusinessGrowthMission[] = []
  if (!hasSearchBaseline) missions.push({
    id: 'growth:' + businessId + ':baseline',
    ventureId, businessId, kind: 'measure_baseline',
    title: MISSION_META.measure_baseline.title,
    stage: 'SCOUT', score: 100, status: 'review_ready', blockers: [],
    evidenceRefs: [], goal: 'verified_contribution',
    proposedXp: 10, earnedXp: 0, requiresApproval: true,
    authorizationEffect: 'NONE', externalActionAuthorized: false,
  })
  const seen = new Set<string>()
  for (const signal of snapshot.signals) {
    const id = required(signal.id, 'SIGNAL_ID')
    if (seen.has(id)) throw new Error('GROWTH_MISSION_DUPLICATE_SIGNAL')
    seen.add(id)
    required(signal.query, 'QUERY')
    nonnegative(signal.impressions, 'IMPRESSIONS')
    nonnegative(signal.clicks, 'CLICKS')
    nonnegative(signal.conversions, 'CONVERSIONS')
    if (signal.existingPageUrl && siteHost(signal.existingPageUrl) !== host) {
      throw new Error('GROWTH_MISSION_PAGE_NOT_OWNED')
    }
    const kind = chooseKind(signal)
    if (!kind) continue
    const refs = unique(signal.evidenceRefs)
    const blockers: string[] = []
    if (!refs.length || refs.some(ref => !evidence.has(ref))) blockers.push('Missing traceable observation evidence')
    if (!hasSearchBaseline && kind !== 'community_research') blockers.push('Verify Search Console baseline before prioritizing production')
    if (kind === 'refresh_page' || kind === 'improve_conversion') {
      if (!hasOwnedEvidence(refs, evidence, 'search_console') && !hasOwnedEvidence(refs, evidence, 'analytics')) {
        blockers.push('Existing-page performance needs first-party evidence')
      }
    } else if (kind === 'create_page') {
      if (!hasOwnedEvidence(refs, evidence, 'market_research') && !hasOwnedEvidence(refs, evidence, 'search_console')) {
        blockers.push('Validate buyer-intent demand before drafting')
      }
    } else if (kind === 'repair_site' && !hasOwnedEvidence(refs, evidence, 'site_audit')) {
      blockers.push('Technical finding requires an auditable site inspection')
    } else if (kind === 'community_research' && !hasOwnedEvidence(refs, evidence, 'community')) {
      blockers.push('Verify the actual conversation and platform rules')
    } else if (kind === 'social_repurpose' && !hasOwnedEvidence(refs, evidence, 'analytics')) {
      blockers.push('Link to an approved original asset and channel evidence')
    }
    // Score measures review priority, not projected revenue, traffic or a ranking guarantee.
    const intent = signal.intent === 'transactional' ? 65 : signal.intent === 'commercial' ? 50 : 15
    const proof = refs.some(ref => evidence.get(ref)?.verified) ? 15 : 0
    const demand = hasOwnedEvidence(refs, evidence, 'search_console')
      ? Math.min(12, Math.floor(Math.log10((signal.impressions ?? 0) + 1) * 4))
      : 0 // browser-entered impressions never inflate a mission score
    const existing = signal.existingPageUrl ? 8 : 0
    const score = Math.min(99, intent + proof + demand + existing)
    const meta = MISSION_META[kind]
    missions.push({
      id: 'growth:' + businessId + ':' + id, ventureId, businessId, kind,
      title: meta.title + ': ' + signal.query.trim(),
      stage: meta.stage, score,
      status: blockers.length ? 'evidence_blocked' : 'review_ready',
      blockers, evidenceRefs: refs, sourceSignalId: id,
      goal: 'verified_contribution', proposedXp: meta.xp, earnedXp: 0,
      requiresApproval: true, authorizationEffect: 'NONE',
      externalActionAuthorized: false,
    })
  }
  missions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const workItems: VentureWorkItem[] = missions.map(mission => ({
    id: mission.id, ventureId, agentId: 'marisa:operations',
    step: 'growth_mission:' + mission.kind,
    status: mission.status === 'review_ready' ? 'queued' : 'blocked',
    createdAt: snapshot.observedAt, updatedAt: snapshot.observedAt,
    evidenceRefs: mission.evidenceRefs, outputRefs: [], spendUsd: 0,
    authorizationEffect: 'NONE',
  }))
  return { missions, workItems, totalEarnedXp: 0, evidenceBackedOutcomes: 0 }
}

/** Only observed commerce settlement can create game XP tied to realized contribution. */
export function scoreBusinessGrowthOutcome(input: {
  missionId: string
  settlementRef?: string
  providerVerified: boolean
  settledGrossProfitUsd?: number
  experimentCostUsd?: number
}): { earnedXp: number; realizedContributionUsd: number | null; verified: boolean } {
  required(input.missionId, 'MISSION_ID')
  nonnegative(input.experimentCostUsd, 'COST')
  if (input.settledGrossProfitUsd !== undefined && !Number.isFinite(input.settledGrossProfitUsd)) {
    throw new Error('GROWTH_MISSION_PROFIT_INVALID')
  }
  if (!input.providerVerified || !input.settlementRef?.trim() || input.settledGrossProfitUsd === undefined) {
    return { earnedXp: 0, realizedContributionUsd: null, verified: false }
  }
  const realizedContributionUsd = input.settledGrossProfitUsd - (input.experimentCostUsd ?? 0)
  return {
    earnedXp: realizedContributionUsd > 0 ? Math.min(100, 20 + Math.floor(realizedContributionUsd)) : 0,
    realizedContributionUsd, verified: true,
  }
}
