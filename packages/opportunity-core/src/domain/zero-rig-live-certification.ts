/**
 * JH-ZERO-RIG.CERT.01-.04 — source/commissioning evidence gate.
 *
 * This is a review contract, not cryptographic proof, a runtime activation,
 * or an independent authority to execute. No self-attested certificate can
 * authorize a payout, agent submission, registration, or spend.
 */
export type ZeroRigAcceptanceEvidenceKind =
  | 'source_ci'
  | 'owner_session'
  | 'provider_200'
  | 'provider_401'
  | 'provider_429'
  | 'schema'
  | 'listing_detail'
  | 'owner_eligibility'
  | 'ios_private_session'
  | 'tenant_isolation'
  | 'money_receipts_separated'
  | 'rate_limit'

export type ZeroRigAcceptanceEvidence = {
  kind: ZeroRigAcceptanceEvidenceKind
  /** Stable reference to an operator-reviewable artifact; do not include keys or PII. */
  evidenceRef: string
  observedAt: string
  /** This flag records the asserted verification state, not independent attestation. */
  ownerReviewed: boolean
}

export type ZeroRigCertificationInput = {
  currentHeadSha: string
  sourceBranchHeadSha: string
  asOf: string
  ownerBindingConfigured: boolean
  agentKeyPresent: boolean
  readFeatureFlagEnabled: boolean
  observations: readonly ZeroRigAcceptanceEvidence[]
  /** Report expected to be signed off by external release authority separately. */
  independentReleaseApproval: boolean
}

const REQUIRED: readonly ZeroRigAcceptanceEvidenceKind[] = [
  'source_ci', 'owner_session', 'provider_200','provider_401','provider_429',
  'schema','listing_detail','owner_eligibility','ios_private_session',
  'tenant_isolation','money_receipts_separated','rate_limit',
]
export type ZeroRigCertificationAssessment = {
  status: 'blocked' | 'awaiting_external_acceptance' | 'ready_for_separate_release_approval'
  verifiedEvidenceKinds: ZeroRigAcceptanceEvidenceKind[]
  missing: ZeroRigAcceptanceEvidenceKind[]
  blockers: string[]
  sourceHeadMatches: boolean
  evidenceFresh: boolean
  manualAcceptanceRequired: true
  /** Never grants approval; external release pipeline owns that. */
  authorizedToPoll: false
  authorizedToSubmit: false
  authorizedToClaim: false
  authorizedToMoveMoney: false
  liveRevenueVerified: false
}

export function assessZeroRigLiveCertification(input: ZeroRigCertificationInput): ZeroRigCertificationAssessment {
  const now = Date.parse(input.asOf)
  const sameHead = /^[0-9a-f]{40}$/.test(input.currentHeadSha) &&
    input.currentHeadSha === input.sourceBranchHeadSha
  const blockers: string[] = []
  if (!sameHead) blockers.push('SOURCE_HEAD_UNVERIFIED_OR_CHANGED')
  if (!Number.isFinite(now)) blockers.push('INVALID_REVIEW_TIME')
  if (!input.ownerBindingConfigured) blockers.push('OWNER_BINDING_NOT_COMMISSIONED')
  if (!input.agentKeyPresent) blockers.push('AGENT_API_KEY_NOT_COMMISSIONED')
  if (!input.readFeatureFlagEnabled) blockers.push('READ_ONLY_FEATURE_FLAG_DISABLED')
  if (!input.independentReleaseApproval) blockers.push('EXTERNAL_RELEASE_APPROVAL_MISSING')
  const seen = new Map<ZeroRigAcceptanceEvidenceKind,ZeroRigAcceptanceEvidence>()
  for (const item of input.observations) {
    const when=Date.parse(item.observedAt)
    if (seen.has(item.kind) || !item.ownerReviewed ||
      !/^[-\w:/.]{8,256}$/.test(item.evidenceRef) ||
      !Number.isFinite(when) || !Number.isFinite(now) ||
      when>now || now-when>24*60*60*1000) continue
    if (REQUIRED.includes(item.kind)) seen.set(item.kind,item)
  }
  const missing=REQUIRED.filter(k=>!seen.has(k))
  const validEvidence=missing.length===0
  if (missing.length) blockers.push('EXTERNAL_ACCEPTANCE_EVIDENCE_INCOMPLETE')
  if (!input.observations.length) blockers.push('NO_LIVE_CANARY_RECEIPTS')
  const status=!sameHead||!Number.isFinite(now)||!input.ownerBindingConfigured||!input.agentKeyPresent
    ? 'blocked'
    : !validEvidence||!input.readFeatureFlagEnabled||!input.independentReleaseApproval
      ? 'awaiting_external_acceptance'
      : 'ready_for_separate_release_approval'
  return {
    status,
    verifiedEvidenceKinds:[...seen.keys()],
    missing,blockers,
    sourceHeadMatches:sameHead,evidenceFresh:validEvidence,
    manualAcceptanceRequired:true,authorizedToPoll:false,authorizedToSubmit:false,
    authorizedToClaim:false,authorizedToMoveMoney:false,liveRevenueVerified:false,
  }
}

/** Safe template: missing means missing, not zero balances or no live opportunities. */
export function zeroRigUncommissionedAssessment(headSha:string, asOf:string):ZeroRigCertificationAssessment {
  return assessZeroRigLiveCertification({
    currentHeadSha:headSha,sourceBranchHeadSha:headSha,asOf,
    ownerBindingConfigured:false,agentKeyPresent:false,readFeatureFlagEnabled:false,
    independentReleaseApproval:false,observations:[],
  })
}
