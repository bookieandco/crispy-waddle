import assert from 'node:assert/strict'
import { buildSearchCommerceDueTaskQueue } from './side-hustle-search-commerce-task-engine.js'
import { diagnoseSearchCommerceStorefront } from './side-hustle-search-commerce-storefront.js'

const diagnostic = diagnoseSearchCommerceStorefront({
  family: 'pod_personalized_commerce',
  observedAt: '2026-10-03T18:00:00.000Z',
  catalog: {
    listingCount: 48,
    listingsByProductType: {
      sweatshirt: 24,
      tshirt: 12,
      journal: 8,
      mug: 1,
      tote: 1,
      ornament: 2,
    },
  },
  traffic: { impressions: 1200, visits: 0, orders: 0 },
  evidenceRefs: ['evidence:etsy-window'],
})

const queue = buildSearchCommerceDueTaskQueue({
  family: 'pod_personalized_commerce',
  businessDate: '2026-10-03',
  lastCompletedDateByRoutine: {
    daily_shop_health: '2026-10-03',
    daily_customer_service: '2026-10-02',
    daily_order_operations: '2026-10-02',
    weekly_listing_inventory: '2026-09-25',
    weekly_conversion_experiments: '2026-09-25',
    weekly_market_research: '2026-09-25',
    monthly_shop_audit: '2026-09-30',
    monthly_operating_plan: '2026-09-30',
    monthly_financial_review: '2026-09-30',
  },
  availableInputKeys: [
    'orders',
    'messages',
    'listing-health observations',
    'provider alerts',
    'open cases',
    'policy context',
    'fulfillment observations',
    'shipping observations',
    'provider exceptions',
    'search demand',
    'product candidates',
    'current listing inventory',
    'seasonal runway',
    'impressions',
    'clicks',
    'visits',
    'conversion',
    'current creative/listing state',
    'market observations',
    'search observations',
    'competitor observations',
    'trend observations',
    'brand state',
    'listings',
    'creative assets',
    'pricing',
    'policies',
    'performance observations',
    'demand windows',
    'inventory roadmap',
    'experiment results',
    'capacity',
    'revenue',
    'product costs',
    'shipping',
    'fees',
    'refunds/reversals',
    'ad spend',
    'provider costs',
  ],
  diagnostic,
})

assert.equal(queue.tasks.length, 9)
assert.equal(queue.dueTasks.length, 8)
assert.equal(queue.blockedDueTasks.length, 0)
assert.equal(
  queue.dueTasks.find((task) => task.routineId === 'weekly_conversion_experiments')?.priority,
  'high',
)
assert.equal(
  queue.dueTasks.find((task) => task.routineId === 'monthly_shop_audit')?.priority,
  'high',
)
assert.equal(
  queue.tasks.find((task) => task.routineId === 'daily_shop_health')?.due,
  false,
)
assert.equal(queue.externalActionAuthorized, false)
assert.equal(queue.moneyMovementAuthorized, false)

const blocked = buildSearchCommerceDueTaskQueue({
  family: 'commerce_affiliate',
  businessDate: '2026-10-03',
  availableInputKeys: ['orders'],
})
assert.equal(blocked.dueTasks.length, 9)
assert.ok(blocked.blockedDueTasks.length > 0)

const weeklyNotDue = buildSearchCommerceDueTaskQueue({
  family: 'digital_products',
  businessDate: '2026-10-03',
  lastCompletedDateByRoutine: {
    weekly_market_research: '2026-09-29',
  },
})
assert.equal(
  weeklyNotDue.tasks.find((task) => task.routineId === 'weekly_market_research')?.due,
  false,
)

assert.throws(
  () => buildSearchCommerceDueTaskQueue({
    family: 'owned_media',
    businessDate: '2026-02-30',
  }),
  /valid calendar date/,
)

assert.throws(
  () => buildSearchCommerceDueTaskQueue({
    family: 'owned_media',
    businessDate: '2026-10-03',
    lastCompletedDateByRoutine: {
      daily_shop_health: '2026-10-04',
    },
  }),
  /future/,
)

console.log('side-hustle-search-commerce-task-engine tests passed')
