import type { Opportunity } from './opportunity.js'

/**
 * JH-ZERO-RIG.02 — Superteam Earn read-only listing boundary.
 * No fetch implementation, credentials, POST, registration, claims or submissions.
 * A future approved transport may implement ONLY the documented GET /api/agents/listings/live.
 */
export const SUPERTEAM_AGENT_LISTINGS_ENDPOINT = 'https://superteam.fun/api/agents/listings/live'
export type ZeroRigBountyListing = {
  id: string
  slug: string
  title: string
  listingType: 'bounty' | 'project' | 'hackathon'
  agentAccess: 'AGENT_ALLOWED' | 'AGENT_ONLY'
  deadline: string
  skills: readonly string[]
  rewardAmount: number | null
  rewardCurrency: string | null
  sourceUrl: string
  sourceId: 'global.superteam-earn'
  evidenceCapturedAt: string
  rewardVerified: false
  eligibilityVerified: false
  submissionAuthorized: false
}

export type ZeroRigScoutResult = {
  listings: ZeroRigBountyListing[]
  rejectedCount: number
  warnings: string[]
  observedAt: string
  authority: 'DISCOVERY_ONLY'
  submissionAuthorized: false
  claimAuthorized: false
  spendingAuthorized: false
}

type ObjectRow = Record<string, unknown>
const row = (v: unknown): ObjectRow | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as ObjectRow : null
const nonblank = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length ? v.trim() : null
const iso = (v: unknown): string | null => {
  const s = nonblank(v)
  const parsed = s && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s) ? Date.parse(s) : NaN
  return s && Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}
const extractArray = (body: unknown): unknown[] => {
  if (Array.isArray(body)) return body
  const envelope = row(body)
  if (!envelope) return []
  for (const candidate of [envelope.result, envelope.listings, envelope.data]) {
    if (Array.isArray(candidate)) return candidate
    const nested = row(candidate)
    if (nested && Array.isArray(nested.listings)) return nested.listings
    if (nested && Array.isArray(nested.items)) return nested.items
  }
  return []
}
const boundedSkills = (v: unknown): string[] => {
  if (!Array.isArray(v)) return []
  return [...new Set(v.slice(0, 30).map(x =>
    typeof x === 'string' ? x : row(x)?.name
  ).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map(x => x.trim().toLowerCase()))]
}

/** Fail closed on unspecified agent access, unknown status, deadlines and payout claims. */
export function normalizeSuperteamAgentListings(body: unknown, observedAt: string): ZeroRigScoutResult {
  const timestamp = iso(observedAt)
  if (!timestamp) throw new Error('ZERO_RIG_INVALID_OBSERVATION_TIME')
  const raw = extractArray(body)
  const listings: ZeroRigBountyListing[] = []
  const seen = new Set<string>()
  let rejectedCount = 0
  for (const item of raw.slice(0, 200)) {
    const o = row(item)
    const slug = nonblank(o?.slug)
    const id = nonblank(o?.id)
    const title = nonblank(o?.title)
    const deadline = iso(o?.deadline)
    const access = o?.agentAccess
    const type = o?.type
    if (!o || o.status !== 'OPEN' || o.isWinnersAnnounced === true ||
      (access !== 'AGENT_ALLOWED' && access !== 'AGENT_ONLY') ||
      (type !== 'bounty' && type !== 'project' && type !== 'hackathon') ||
      !slug || !/^[a-z0-9-]{1,128}$/.test(slug) || !id || !title ||
      !deadline || Date.parse(deadline) <= Date.parse(timestamp) || seen.has(id)) {
      rejectedCount++
      continue
    }
    seen.add(id)
    const reward = o.rewardAmount
    const amount = typeof reward === 'number' && Number.isFinite(reward) && reward >= 0 ? reward : null
    const currency = nonblank(o.token)
    listings.push({
      id, slug, title, listingType: type, agentAccess: access, deadline,
      skills: boundedSkills(o.skills), rewardAmount: amount, rewardCurrency: currency,
      sourceUrl: 'https://superteam.fun/earn/listing/' + encodeURIComponent(slug),
      sourceId: 'global.superteam-earn', evidenceCapturedAt: timestamp,
      rewardVerified: false, eligibilityVerified: false, submissionAuthorized: false,
    })
  }
  const warnings = ['Listings, terms, rewards and eligibility require current official detail verification before any work.']
  if (!Array.isArray(body) && !row(body)) warnings.push('Unrecognized source payload; no listings admitted.')
  if (raw.length > 200) warnings.push('Source feed truncated to 200 observations.')
  return {
    listings, rejectedCount: rejectedCount + Math.max(0, raw.length - 200),
    warnings, observedAt: timestamp, authority: 'DISCOVERY_ONLY',
    submissionAuthorized: false, claimAuthorized: false, spendingAuthorized: false,
  }
}

export interface SuperteamReadOnlyListingReader {
  /** Only an injected, authorization-controlled GET reader; must not POST or spend. */
  readLiveListings(input: { take: number; deadline: string }): Promise<unknown>
}

export async function scoutSuperteamAgentListings(
  reader: SuperteamReadOnlyListingReader,
  input: { now: string; take?: number },
): Promise<ZeroRigScoutResult> {
  const now = iso(input.now)
  if (!now) throw new Error('ZERO_RIG_INVALID_OBSERVATION_TIME')
  const limit = Math.min(50, Math.max(1, Number.isInteger(input.take) ? input.take! : 20))
  const response = await reader.readLiveListings({ take: limit, deadline: now })
  return normalizeSuperteamAgentListings(response, now)
}

/** Projection into the existing canonical Opportunity truth; discovery is NEVER verification. */
export function zeroRigBountyToOpportunity(listing: ZeroRigBountyListing): Opportunity {
  const capturedAt = listing.evidenceCapturedAt
  return {
    id: 'zero-rig:superteam:' + listing.id, title: listing.title,
    family: 'business', type: listing.listingType === 'bounty' ? 'prize' : 'gig',
    sourceUrl: listing.sourceUrl, sourceName: 'Superteam Earn', sourceId: listing.sourceId,
    amount: listing.rewardAmount !== null && listing.rewardCurrency
      ? { min: listing.rewardAmount, max: listing.rewardAmount, currency: listing.rewardCurrency }
      : undefined,
    deadline: listing.deadline,
    requirements: ['Human claimant and eligibility verification required before any submission'],
    claims: [], evidence: [{
      id: 'zero-rig:superteam:' + listing.id + ':discovery',
      sourceId: listing.sourceId, sourceUrl: listing.sourceUrl,
      sourceName: 'Superteam Earn agent listing', sourceType: 'official',
      capturedAt, confidence: 0.5,
    }],
    verificationStatus: 'unverified', sourceConfidence: 0.5,
    riskFlags: ['external_source_unverified', 'reward_not_verified', 'human_claim_required', 'submission_not_authorized'],
    metadata: { agentAccess: listing.agentAccess, listingType: listing.listingType, skills: [...listing.skills] },
    status: 'discovered', createdAt: capturedAt, updatedAt: capturedAt,
  }
}
