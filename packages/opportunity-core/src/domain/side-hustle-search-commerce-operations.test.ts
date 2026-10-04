import assert from 'node:assert/strict'
import {
  SEARCH_COMMERCE_OPERATING_ROUTINES,
  SEARCH_COMMERCE_SOURCE_CLAIMS,
  buildSearchCommerceOperatingPlan,
  routinesForCadence,
} from './side-hustle-search-commerce-operations.js'

const plan = buildSearchCommerceOperatingPlan({
  family: 'pod_personalized_commerce',
  generatedAt: '2026-10-04T06:45:00.000Z',
})

assert.equal(plan.routines.length, 9)
assert.equal(routinesForCadence(plan, 'daily').length, 3)
assert.equal(routinesForCadence(plan, 'weekly').length, 3)
assert.equal(routinesForCadence(plan, 'monthly').length, 3)
assert.equal(plan.externalActionAuthorized, false)
assert.equal(plan.publishingAuthorized, false)
assert.equal(plan.purchasingAuthorized, false)
assert.equal(plan.moneyMovementAuthorized, false)

assert.deepEqual(
  routinesForCadence(plan, 'weekly').map((routine) => routine.id),
  [
    'weekly_listing_inventory',
    'weekly_conversion_experiments',
    'weekly_market_research',
  ],
)

assert.ok(
  SEARCH_COMMERCE_OPERATING_ROUTINES
    .filter((routine) => routine.id === 'monthly_financial_review')
    .every((routine) => routine.requiredInputs.includes('refunds/reversals')),
)

assert.ok(
  SEARCH_COMMERCE_SOURCE_CLAIMS.every(
    (claim) => claim.status !== 'measured_local_result',
  ),
  'Transcript claims must not be promoted to measured local truth.',
)

const affiliatePlan = buildSearchCommerceOperatingPlan({
  family: 'commerce_affiliate',
  enabledRoutineIds: ['weekly_market_research', 'monthly_financial_review'],
})
assert.deepEqual(
  affiliatePlan.routines.map((routine) => routine.id),
  ['weekly_market_research', 'monthly_financial_review'],
)

assert.throws(
  () => buildSearchCommerceOperatingPlan({ family: 'media_production' }),
  /not registered/,
)

assert.throws(
  () => buildSearchCommerceOperatingPlan({
    family: 'digital_products',
    generatedAt: 'not-a-date',
  }),
  /valid date/,
)

console.log('side-hustle-search-commerce-operations tests passed')
