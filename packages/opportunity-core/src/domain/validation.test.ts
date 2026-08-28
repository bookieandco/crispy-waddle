import { validateOpportunity } from './validation.js'
import { ripplingGrantFixture, samFixture, verifiedOverageFixture } from '../fixtures/canonical.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const samResult = validateOpportunity(samFixture)
assert(samResult.valid, 'Valid SAM opportunity should pass structural validation')
assert(!samResult.ready, 'Verified SAM fixture should not be ready without ready status')

const overageResult = validateOpportunity(verifiedOverageFixture)
assert(overageResult.valid, 'Verified overage should pass structural validation')
assert(!overageResult.ready, 'Verified overage should not be action-ready implicitly')

const grantResult = validateOpportunity(ripplingGrantFixture)
assert(grantResult.valid, 'Unverified grant can be structurally valid')
assert(!grantResult.ready, 'Unverified grant must not be ready')
