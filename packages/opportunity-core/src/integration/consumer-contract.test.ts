import { adaptSamOpportunity, adaptOverageOpportunity, isCompleteVerification, validateOpportunity } from '../index.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const sam = adaptSamOpportunity({
  noticeId: 'INTEGRATION-SAM-001',
  title: 'Integration Contract Fixture',
  sourceUrl: 'https://sam.gov/content/opportunities',
})

const overage = adaptOverageOpportunity({
  id: 'INTEGRATION-OVERAGE-001',
  title: 'Integration Recovery Fixture',
  sourceUrl: 'https://example.gov/overage/fixture',
})

assert(sam.id === 'sam:INTEGRATION-SAM-001', 'SAM consumer boundary must expose canonical ID')
assert(sam.type === 'contract', 'SAM consumer boundary must expose canonical opportunity type')
assert(overage.id === 'overage:INTEGRATION-OVERAGE-001', 'Overage consumer boundary must expose canonical ID')
assert(overage.type === 'recovery', 'Overage consumer boundary must expose canonical opportunity type')
assert(overage.verificationStatus !== 'verified', 'Raw Overage input must not manufacture verified status')
assert(!isCompleteVerification(overage.verificationDecision), 'Raw Overage input must not have a complete verification decision')
assert(validateOpportunity(overage).valid, 'Raw Overage opportunity should remain structurally valid')

const verifiedDecision = {
  id: 'verification:INTEGRATION-OVERAGE-001',
  opportunityId: overage.id,
  status: 'verified' as const,
  checks: {
    source_record: 'verified' as const,
    property_reference: 'verified' as const,
    claimant_identity: 'verified' as const,
    entitlement: 'verified' as const,
  },
  evidenceRefs: ['INTEGRATION-OVERAGE-001:source'],
  reviewerRef: 'integration-reviewer',
  verifiedAt: '2026-08-31T00:00:00.000Z',
}

const verifiedOverage = adaptOverageOpportunity({
  id: 'INTEGRATION-OVERAGE-001-VERIFIED',
  title: 'Verified Integration Recovery Fixture',
  sourceUrl: 'https://example.gov/overage/fixture',
  verificationChecks: verifiedDecision.checks,
  verificationDecision: verifiedDecision,
})

assert(verifiedOverage.verificationStatus === 'verified', 'Complete verification decision must produce verified status')
assert(isCompleteVerification(verifiedOverage.verificationDecision), 'Verified recovery must carry a complete verification decision')
assert(validateOpportunity(verifiedOverage).valid, 'Verified recovery must pass domain validation')
