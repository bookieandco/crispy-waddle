import { reconciliationDecision, chooseClaimSource } from '../domain/reconciliation.js'
import { pendingOverageFixture, ripplingGrantFixture, samFixture, verifiedOverageFixture } from './canonical.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

assert(samFixture.family === 'funding', 'SAM must normalize to funding family')
assert(samFixture.type === 'contract', 'SAM must normalize to contract type')
assert(samFixture.verificationStatus === 'verified', 'SAM fixture must be verified from official source')

assert(verifiedOverageFixture.family === 'recovery', 'Overage must normalize to recovery family')
assert(verifiedOverageFixture.verificationStatus === 'verified', 'Fully verified overage must be verified')
assert(pendingOverageFixture.verificationStatus === 'partially_verified', 'Incomplete overage must remain partially verified')
assert(reconciliationDecision(pendingOverageFixture) === 'needs_human_review', 'Incomplete overage must require review')

assert(ripplingGrantFixture.type === 'grant', 'Rippling fixture must normalize to grant')
assert(ripplingGrantFixture.verificationStatus === 'unverified', 'Secondary transcript grant must remain unverified')
assert(reconciliationDecision(ripplingGrantFixture) === 'needs_human_review', 'Unverified grant must require review')
assert(chooseClaimSource(ripplingGrantFixture.claims) === 'transcript:rippling', 'Grant claims must retain transcript provenance')
