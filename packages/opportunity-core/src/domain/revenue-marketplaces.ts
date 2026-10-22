import type { Opportunity } from './opportunity.js'

/** JH-REVENUE.03: bounded evidence adapter for official Algora/Opire bounty snapshots.
 * Does not scrape, log in, make GitHub comments, auto-claim, or assert that a
 * third-party bounty will pay. Feed it separately authorized source observations.
 */
export type BountyMarketplace = 'algora' | 'opire'
export type MarketplaceBountyObservation = {
  platform: BountyMarketplace
  sourceUrl: string
  githubIssueUrl: string
  title: string
  status: 'OPEN' | 'CLOSED' | 'UNKNOWN'
  capturedAt: string
  rewardAmount: number | null
  rewardCurrency: string | null
  payerDisplayName: string | null
  competingClaims: number | null
  /** The user must independently establish these; supplied text is never proof. */
  evidenceExcerpt?: string
}
export type MarketplaceBountyIntake = {
  opportunities: Opportunity[]
  rejectedCount: number
  duplicateCount: number
  blockers: string[]
  executionAuthorized: false
  paymentVerified: false
}
function cleanUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.hash || url.search) return null
    return url
  } catch { return null }
}
function issueKey(source: string): string | null {
  const u = cleanUrl(source)
  if (!u || u.hostname !== 'github.com') return null
  const match = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/([1-9]\d{0,8})\/?$/.exec(u.pathname)
  if (!match) return null
  return match[1]!.toLowerCase() + '/' + match[2]!.toLowerCase() + '/issues/' + match[3]
}
function isOfficialMarketplace(platform: BountyMarketplace, source: string): boolean {
  const u = cleanUrl(source)
  return !!u && (platform === 'algora'
    ? u.hostname === 'algora.io' && u.pathname !== '/'
    : ['opire.dev','app.opire.dev'].includes(u.hostname) && u.pathname !== '/')
}
function validTime(value: string): number {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
    ? Date.parse(value) : NaN
}
export function normalizeMarketplaceBounties(
  observations: readonly MarketplaceBountyObservation[],
  now: string,
): MarketplaceBountyIntake {
  const time = validTime(now)
  if (!Number.isFinite(time)) throw new Error('REVENUE_MARKETPLACE_NOW_INVALID')
  if (!Array.isArray(observations) || observations.length > 100) throw new Error('REVENUE_MARKETPLACE_BATCH_LIMIT')
  const opportunities: Opportunity[] = []
  const seen = new Set<string>()
  let rejectedCount = 0, duplicateCount = 0
  const blockers: string[] = []
  for (const o of observations) {
    const issue = typeof o?.githubIssueUrl === 'string' ? issueKey(o.githubIssueUrl) : null
    const captured = validTime(o?.capturedAt)
    if (!issue || !isOfficialMarketplace(o.platform, o.sourceUrl) ||
      typeof o.title !== 'string' || !o.title.trim() || o.title.length > 240 ||
      o.status !== 'OPEN' || !Number.isFinite(captured) || captured > time ||
      time - captured > 24*60*60*1000) {
      rejectedCount++
      continue
    }
    const id = 'revenue:' + o.platform + ':' + issue
    if (seen.has(id)) { duplicateCount++; continue }
    seen.add(id)
    const amount = typeof o.rewardAmount === 'number' && Number.isFinite(o.rewardAmount) &&
      o.rewardAmount > 0 && o.rewardAmount <= 10_000_000 ? o.rewardAmount : null
    const currency = typeof o.rewardCurrency === 'string' ? o.rewardCurrency.toUpperCase() : null
    const competitorVerified = Number.isSafeInteger(o.competingClaims) && o.competingClaims !== null && o.competingClaims >= 0
    const payer = typeof o.payerDisplayName === 'string' && o.payerDisplayName.trim()
      ? o.payerDisplayName.trim() : null
    const risks = [
      'unverified_payer', 'unverified_ai_policy', 'unverified_acceptance',
      'no_submission_authority',
      o.platform === 'opire' ? 'direct_payer_no_guaranteed_escrow' : 'escrow_not_independently_verified',
    ]
    if (!payer) risks.push('payer_identity_missing')
    if (!competitorVerified) risks.push('competition_unknown')
    if (amount === null || currency !== 'USD') risks.push('usd_reward_unverified')
    const stamp = new Date(captured).toISOString()
    opportunities.push({
      id, title:o.title.trim(), family:'business', type:'gig',
      description:'Read-only external coding bounty observation; reward and eligibility not independently certified',
      sourceUrl:o.sourceUrl, sourceName:o.platform === 'algora' ? 'Algora' : 'Opire',
      sourceId:'global.' + o.platform,
      amount:amount !== null && currency === 'USD' ? {min:amount,max:amount,currency:'USD'} : undefined,
      claims:[], evidence:[{
        id:id+':observed',sourceId:'global.'+o.platform,sourceUrl:o.sourceUrl,
        sourceName:o.platform,sourceType:'secondary',
        capturedAt:stamp,confidence:0.3,
        excerpt:typeof o.evidenceExcerpt === 'string' ? o.evidenceExcerpt.slice(0,500) : undefined,
      }],
      verificationStatus:'unverified',sourceConfidence:0.3,
      requirements:['Check original GitHub issue, funder, AI rules, payment terms and competing claims'],
      riskFlags:risks, status:'discovered',createdAt:stamp,updatedAt:stamp,
      metadata:{
        githubIssueUrl:'https://github.com/'+issue,
        competingClaims:competitorVerified ? o.competingClaims : null,
        payerDisplayName:payer, payerVerified:false, paymentVerified:false,
        escrowVerified:false, aiWorkAllowed:null, marketObservationOnly:true,
      },
    })
  }
  if (rejectedCount) blockers.push('OBSERVATIONS_REJECTED_MALFORMED_CLOSED_STALE_OR_NONOFFICIAL')
  if (duplicateCount) blockers.push('DUPLICATE_SOURCE_ISSUES_SKIPPED')
  return {opportunities,rejectedCount,duplicateCount,blockers,
    executionAuthorized:false,paymentVerified:false}
}
