import type { ZeroRigBountyListing } from './zero-rig-superteam.js'
import type { ZeroRigEconomicsAssessment } from './zero-rig-economics.js'

/**
 * JH-ZERO-RIG.04 — Skills-to-bounty proposal ONLY.
 * No unsanctioned writing/submission, scraping other entrants, claims, wallets or outreach.
 */
export type ZeroRigAgentCapability = {
  skill: string
  available: boolean
  confidence: number
  evidenceRefs: readonly string[]
}
export type ZeroRigBountyFitInput = {
  listing: ZeroRigBountyListing
  capabilities: readonly ZeroRigAgentCapability[]
  estimatedEffortHours: number | null
  maxEffortHours: number
  eligibility: 'owner_confirmed' | 'unknown' | 'ineligible'
  rewardEconomics?: ZeroRigEconomicsAssessment
  now: string
}
export type ZeroRigBountyProposal = {
  listingId: string
  verdict: 'research' | 'reject' | 'candidate_for_owner_review'
  matchedSkills: string[]
  missingSkills: string[]
  reasons: string[]
  ownerReviewRequired: true
  originalWorkRequired: true
  submissionAuthorized: false
  claimAuthorized: false
  spendingAuthorized: false
}
export function matchZeroRigBounty(input: ZeroRigBountyFitInput): ZeroRigBountyProposal {
  const matchedSkills: string[] = []
  const missingSkills: string[] = []
  const reasons: string[] = []
  const map = new Map(input.capabilities.map(cap => [cap.skill.trim().toLowerCase(), cap]))
  for (const skill of input.listing.skills) {
    const cap = map.get(skill.trim().toLowerCase())
    if (cap?.available && Number.isFinite(cap.confidence) && cap.confidence >= 0.7 &&
      cap.evidenceRefs.some(ref => !!ref.trim())) matchedSkills.push(skill)
    else missingSkills.push(skill)
  }
  const deadline = Date.parse(input.listing.deadline)
  const now = Date.parse(input.now)
  if (!Number.isFinite(deadline) || !Number.isFinite(now) || deadline <= now) reasons.push('DEADLINE_EXPIRED_OR_UNKNOWN')
  if (input.eligibility === 'ineligible') reasons.push('OWNER_INELIGIBLE')
  if (missingSkills.length > 0) reasons.push('MISSING_VERIFIED_CAPABILITIES')
  if (input.listing.skills.length === 0) reasons.push('SKILL_REQUIREMENTS_UNVERIFIED')
  if (input.estimatedEffortHours === null || !Number.isFinite(input.estimatedEffortHours) ||
    input.estimatedEffortHours <= 0 || !Number.isFinite(input.maxEffortHours) ||
    input.maxEffortHours <= 0) reasons.push('EFFORT_UNKNOWN')
  else if (input.estimatedEffortHours > input.maxEffortHours) reasons.push('EFFORT_EXCEEDS_BUDGET')
  if (input.eligibility === 'unknown') reasons.push('OWNER_ELIGIBILITY_UNVERIFIED')
  if (!input.rewardEconomics || input.rewardEconomics.id !== input.listing.id ||
    input.rewardEconomics.decision === 'insufficient_data') reasons.push('ECONOMICS_UNVERIFIED')
  if (input.rewardEconomics?.decision === 'reject') reasons.push('ECONOMICS_REJECTED')
  const rejected = reasons.some(r => r === 'OWNER_INELIGIBLE' || r === 'DEADLINE_EXPIRED_OR_UNKNOWN' ||
    r === 'EFFORT_EXCEEDS_BUDGET' || r === 'ECONOMICS_REJECTED')
  return {
    listingId: input.listing.id,
    verdict: rejected ? 'reject' : reasons.length ? 'research' : 'candidate_for_owner_review',
    matchedSkills, missingSkills, reasons,
    ownerReviewRequired: true, originalWorkRequired: true, submissionAuthorized: false,
    claimAuthorized: false, spendingAuthorized: false,
  }
}
