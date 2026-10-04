import assert from 'node:assert/strict'
import {
  ETSY_100K_SELLER_SOURCE_BENCHMARK,
  diagnoseSearchCommerceStorefront,
} from './side-hustle-search-commerce-storefront.js'

const fragmented = diagnoseSearchCommerceStorefront({
  family: 'pod_personalized_commerce',
  observedAt: '2026-10-04T06:50:00.000Z',
  catalog: {
    listingCount: 48,
    listingsByProductType: {
      sweatshirt: 24,
      tshirt: 10,
      journal: 6,
      ornament: 2,
      tote: 2,
      mug: 1,
      hat: 1,
      case: 1,
      digital: 1,
    },
  },
  traffic: { impressions: 500, visits: 0, orders: 0 },
  professionalPrimaryImageCoverage: 1,
  evidenceRefs: ['evidence:shop-snapshot'],
})

assert.equal(fragmented.funnelStage, 'impressions_without_visits')
assert.equal(fragmented.catalog.productTypeCount, 9)
assert.equal(fragmented.catalog.singletonProductTypeCount, 4)
assert.equal(fragmented.catalog.dominantProductType, 'sweatshirt')
assert.equal(fragmented.catalog.dominantProductTypeShare, 0.5)
assert.equal(fragmented.externalActionAuthorized, false)
assert.ok(fragmented.experimentCandidates.some((item) => item.includes('focus-first')))

const conversionGap = diagnoseSearchCommerceStorefront({
  family: 'digital_products',
  observedAt: '2026-10-04T06:50:00.000Z',
  catalog: {
    listingCount: 12,
    listingsByProductType: { template: 12 },
  },
  traffic: { impressions: 1000, visits: 80, orders: 0 },
  policiesConfigured: true,
  faqConfigured: false,
  evidenceRefs: ['evidence:funnel'],
})
assert.equal(conversionGap.funnelStage, 'visits_without_orders')
assert.ok(conversionGap.experimentCandidates.some((item) => item.includes('pricing')))

const incomplete = diagnoseSearchCommerceStorefront({
  family: 'commerce_affiliate',
  observedAt: '2026-10-04T06:50:00.000Z',
  catalog: {
    listingCount: 3,
    listingsByProductType: { comparison_page: 3 },
  },
  traffic: { impressions: 10 },
  evidenceRefs: ['evidence:partial'],
})
assert.equal(incomplete.funnelStage, 'evidence_insufficient')

assert.equal(ETSY_100K_SELLER_SOURCE_BENCHMARK.causalAuthority, false)
assert.equal(ETSY_100K_SELLER_SOURCE_BENCHMARK.metrics.length, 25)
assert.equal(
  ETSY_100K_SELLER_SOURCE_BENCHMARK.metrics.find((metric) => metric.id === 'listing_count_median')?.value,
  1611,
)
assert.ok(
  ETSY_100K_SELLER_SOURCE_BENCHMARK.caveats.some((caveat) =>
    caveat.includes('survivorship'),
  ),
)

assert.throws(
  () => diagnoseSearchCommerceStorefront({
    family: 'media_production',
    observedAt: '2026-10-04T06:50:00.000Z',
    catalog: { listingCount: 1, listingsByProductType: { video: 1 } },
    traffic: { impressions: 1, visits: 1, orders: 1 },
    evidenceRefs: ['evidence:x'],
  }),
  /not registered/,
)

assert.throws(
  () => diagnoseSearchCommerceStorefront({
    family: 'owned_media',
    observedAt: '2026-10-04T06:50:00.000Z',
    catalog: { listingCount: 2, listingsByProductType: { article: 1 } },
    traffic: { impressions: 1, visits: 1, orders: 0 },
    evidenceRefs: ['evidence:x'],
  }),
  /sum to listingCount/,
)

console.log('side-hustle-search-commerce-storefront tests passed')
