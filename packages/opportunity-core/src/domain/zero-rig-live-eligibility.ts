import type { ZeroRigBountyListing } from './zero-rig-superteam.js'

/** JH-ZERO-RIG.LIVE.02 — strictly evidentiary owner eligibility readiness. */
export type ZeroRigOwnerEligibilityInput = {
  listing: ZeroRigBountyListing
  asOf: string
  operatorCountry: string | null
  allowedCountryCodes: readonly string[] | null
  agentTermsAcknowledged: boolean
  humanClaimantProfileVerified: boolean
  originalWorkPlanEvidence: readonly string[]
  listingDetailEvidence: readonly string[]
  requiredEligibilityAnswersReviewed: boolean
  projectTelegramUrlConfirmed: boolean
}
export type ZeroRigOwnerEligibilityAssessment = {
  listingId: string
  status: 'blocked' | 'needs_owner_review' | 'eligible_for_research'
  reasons: string[]
  evidenceRefs: string[]
  ownerApprovalRequired: true
  payoutEligibilityVerified: false
  submissionAuthorized: false
  accountCreationAuthorized: false
  paymentAuthorized: false
}

const verifiedRefs = (r: readonly string[]) =>
  r.length > 0 && r.every(ref => typeof ref === 'string' && ref.trim().length > 0)

export function assessZeroRigOwnerEligibility(input: ZeroRigOwnerEligibilityInput): ZeroRigOwnerEligibilityAssessment {
  const reasons: string[] = []
  const deadline = Date.parse(input.listing.deadline), at = Date.parse(input.asOf)
  if (!Number.isFinite(at) || !Number.isFinite(deadline) || deadline <= at) reasons.push('LISTING_EXPIRED')
  if (!['AGENT_ALLOWED','AGENT_ONLY'].includes(input.listing.agentAccess)) reasons.push('AGENT_NOT_ELIGIBLE')
  if (!input.agentTermsAcknowledged) reasons.push('TERMS_NOT_REVIEWED')
  if (!input.humanClaimantProfileVerified) reasons.push('HUMAN_CLAIMANT_NOT_VERIFIED')
  if (!verifiedRefs(input.listingDetailEvidence)) reasons.push('OFFICIAL_LISTING_DETAILS_NOT_VERIFIED')
  if (!input.requiredEligibilityAnswersReviewed) reasons.push('ELIGIBILITY_QUESTIONS_NOT_REVIEWED')
  if (!verifiedRefs(input.originalWorkPlanEvidence)) reasons.push('ORIGINAL_WORK_PLAN_MISSING')
  const country = input.operatorCountry?.trim().toUpperCase()
  if (!country || !/^[A-Z]{2}$/.test(country)) reasons.push('COUNTRY_UNKNOWN')
  if (input.allowedCountryCodes === null) reasons.push('LISTING_GEO_RULES_UNKNOWN')
  else if (country && input.allowedCountryCodes.length &&
    !input.allowedCountryCodes.map(s=>s.trim().toUpperCase()).includes(country)) reasons.push('COUNTRY_NOT_ELIGIBLE')
  if (input.listing.listingType === 'project' && !input.projectTelegramUrlConfirmed) {
    reasons.push('PROJECT_REQUIRES_HUMAN_TELEGRAM')
  }
  const blocked = reasons.some(r=>['LISTING_EXPIRED','AGENT_NOT_ELIGIBLE','COUNTRY_NOT_ELIGIBLE'].includes(r))
  return {
    listingId: input.listing.id,
    status: blocked ? 'blocked' : reasons.length ? 'needs_owner_review' : 'eligible_for_research',
    reasons,
    evidenceRefs:[...new Set([...input.listingDetailEvidence,...input.originalWorkPlanEvidence])].filter(s=>!!s.trim()),
    ownerApprovalRequired:true, payoutEligibilityVerified:false, submissionAuthorized:false,
    accountCreationAuthorized:false, paymentAuthorized:false,
  }
}
