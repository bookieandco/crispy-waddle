import { validateOpportunity } from './validation.js'
import { isOpportunityVerified } from './opportunity.js'
import { ripplingGrantFixture, samFixture, verifiedOverageFixture } from '../fixtures/canonical.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const samResult = validateOpportunity(samFixture)
assert(samResult.valid, 'Valid SAM opportunity should pass structural validation')
assert(!samResult.ready, 'Verified SAM fixture should not be ready without ready status')

const overageResult = validateOpportunity(verifiedOverageFixture)
assert(overageResult.valid, 'Verified overage should pass structural validation')
assert(isOpportunityVerified(verifiedOverageFixture), 'Complete verification decision must establish verification truth')
assert(verifiedOverageFixture.status === 'discovered', 'Verified overage evidence must not skip research lifecycle')
assert(!overageResult.ready, 'Verified overage should not be action-ready implicitly')

const grantResult = validateOpportunity(ripplingGrantFixture)
assert(grantResult.valid, 'Unverified grant can be structurally valid')
assert(!grantResult.ready, 'Unverified grant must not be ready')


const mismatchedVerification = validateOpportunity({
  ...verifiedOverageFixture,
  verificationDecision: verifiedOverageFixture.verificationDecision
    ? { ...verifiedOverageFixture.verificationDecision, opportunityId: 'overage:DIFFERENT-CLAIM' }
    : undefined,
})
assert(!mismatchedVerification.valid, 'Cross-opportunity verification decision must be rejected')
