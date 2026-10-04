import assert from 'node:assert/strict'
import {SIDE_HUSTLE_DEFINITIONS,SIDE_HUSTLE_FAMILY_IDS} from './side-hustles.js'
import {
  getSideHustleExecutorRegistration,
  listSideHustleExecutorRegistrations,
  SIDE_HUSTLE_EXECUTOR_REGISTRY,
} from './side-hustle-executor-registry.js'

const rows=listSideHustleExecutorRegistrations()
assert.equal(rows.length,26)
assert.equal(new Set(rows.map(row=>row.family)).size,26)
assert.deepEqual(rows.map(row=>row.family),SIDE_HUSTLE_DEFINITIONS.map(row=>row.family))

for(const family of SIDE_HUSTLE_FAMILY_IDS){
  const registration=getSideHustleExecutorRegistration(family)
  assert.equal(registration,SIDE_HUSTLE_EXECUTOR_REGISTRY[family])
  assert.equal(registration.family,family)
  assert.ok(registration.runtimeRef.trim().length>0)
  assert.ok(registration.executionOwners.length>0)
  assert.equal(registration.externalActionAuthorized,false)
  assert.equal(registration.moneyMovementAuthorized,false)
}

for(const family of [
  'ai_business_implementation',
  'business_automation',
  'content_social',
  'media_production',
  'research_services',
  'procurement_subcontracting',
] as const){
  const registration=getSideHustleExecutorRegistration(family)
  assert.equal(registration.primaryRuntime,'commercial_service')
  assert.equal(registration.apiRef,'/api/opportunities/:id/commercial/work-orders/template')
}

for(const family of [
  'digital_products',
  'software_apps',
  'communities',
  'commerce_affiliate',
  'directories_marketplaces',
] as const){
  const registration=getSideHustleExecutorRegistration(family)
  assert.equal(registration.primaryRuntime,'revenue_product')
  assert.equal(registration.apiRef,'/api/opportunities/:id/commerce')
}

for(const family of ['creative_advertising','media_production','owned_media'] as const){
  const registration=getSideHustleExecutorRegistration(family)
  assert.ok(registration.supportingRefs.includes('packages/director-core/src/creative-factory-routing.ts'))
  assert.ok(registration.supportingRefs.includes('.github/workflows/director-creative-factory-once.yml'))
}
assert.ok(
  getSideHustleExecutorRegistration('owned_media').supportingRefs
    .includes('packages/shotlist-core/src/youtube-channel-intelligence.ts'),
)

assert.equal(getSideHustleExecutorRegistration('owned_media').primaryRuntime,'owned_media')
assert.equal(getSideHustleExecutorRegistration('physical_asset_businesses').primaryRuntime,'physical_asset')
assert.equal(getSideHustleExecutorRegistration('drop_servicing').primaryRuntime,'drop_servicing')
assert.equal(getSideHustleExecutorRegistration('pod_personalized_commerce').primaryRuntime,'pupsonstuff')
assert.equal(getSideHustleExecutorRegistration('dropshipping_product_commerce').primaryRuntime,'dropshipping')

const money=getSideHustleExecutorRegistration('trading_investing_intelligence')
assert.equal(money.primaryRuntime,'money_capability')
assert.equal(money.capabilityOnly,true)
assert.equal(money.requiresCommissioning,false)
assert.equal(money.apiRef,undefined)

console.log('side hustle executor registry tests passed')
