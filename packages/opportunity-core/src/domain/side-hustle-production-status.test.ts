import assert from 'node:assert/strict'
import {
  SIDE_HUSTLE_DEFINITIONS,
  SIDE_HUSTLE_FAMILY_IDS,
} from './side-hustles.js'
import {
  getSideHustleProductionStatus,
  listSideHustleProductionStatus,
  SIDE_HUSTLE_PRODUCTION_STATUS,
} from './side-hustle-production-status.js'

const rows = listSideHustleProductionStatus()

assert.equal(rows.length, SIDE_HUSTLE_DEFINITIONS.length)
assert.equal(new Set(rows.map((row) => row.family)).size, SIDE_HUSTLE_FAMILY_IDS.length)

for (const family of SIDE_HUSTLE_FAMILY_IDS) {
  const row = getSideHustleProductionStatus(family)
  assert.equal(row, SIDE_HUSTLE_PRODUCTION_STATUS[family])
  assert.equal(row.family, family)
  assert.ok(row.summary.trim().length > 0)
  assert.ok(row.evidenceRefs.length >= 3)
  assert.ok(row.nextMilestones.length >= 1)
  assert.equal(row.externalActionAuthorized, false)
  assert.equal(row.moneyMovementAuthorized, false)
}

assert.equal(getSideHustleProductionStatus('trading_investing_intelligence').readiness, 'capability_only')
assert.equal(getSideHustleProductionStatus('trading_investing_intelligence').liveCommercialEvidenceRequired, false)
assert.notEqual(getSideHustleProductionStatus('pod_personalized_commerce').readiness, 'validation_ready')
assert.notEqual(getSideHustleProductionStatus('dropshipping_product_commerce').readiness, 'validation_ready')
assert.notEqual(getSideHustleProductionStatus('procurement_subcontracting').readiness, 'validation_ready')
assert.equal(getSideHustleProductionStatus('digital_products').readiness, 'adapter_ready')
assert.equal(getSideHustleProductionStatus('software_apps').readiness, 'adapter_ready')
assert.equal(getSideHustleProductionStatus('communities').readiness, 'adapter_ready')
assert.equal(getSideHustleProductionStatus('commerce_affiliate').readiness, 'adapter_ready')
assert.equal(getSideHustleProductionStatus('directories_marketplaces').readiness, 'adapter_ready')
assert.equal(getSideHustleProductionStatus('owned_media').readiness, 'adapter_ready')
assert.equal(getSideHustleProductionStatus('physical_asset_businesses').readiness, 'adapter_ready')

for (const row of rows) {
  if (row.readiness === 'capability_only') continue
  assert.notEqual(
    row.readiness,
    'validation_ready',
    `${row.family} must have an executable production spine, adapter, or live-candidate path`,
  )
}

for (const family of [
  'ai_business_implementation',
  'business_automation',
  'business_systems',
  'drop_servicing',
  'boring_business_services',
  'website_revenue_systems',
  'human_premium_services',
] as const) {
  assert.equal(getSideHustleProductionStatus(family).readiness, 'execution_spine')
}

console.log('side hustle production readiness map tests passed')
