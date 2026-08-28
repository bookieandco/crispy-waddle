import { adaptSamOpportunity, adaptOverageOpportunity } from '../index.js'

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
  claimantVerified: true,
  saleVerified: true,
  entitlementVerified: true,
  sourceRecordVerified: true,
})

assert(sam.id === 'sam:INTEGRATION-SAM-001', 'SAM consumer boundary must expose canonical ID')
assert(sam.type === 'contract', 'SAM consumer boundary must expose canonical opportunity type')
assert(overage.id === 'overage:INTEGRATION-OVERAGE-001', 'Overage consumer boundary must expose canonical ID')
assert(overage.type === 'recovery', 'Overage consumer boundary must expose canonical opportunity type')
assert(overage.verificationStatus === 'verified', 'Verified recovery must remain verified at consumer boundary')
