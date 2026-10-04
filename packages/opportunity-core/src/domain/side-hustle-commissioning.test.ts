import assert from 'node:assert/strict'
import {
  buildSideHustleCommissioningItem,
  listSideHustleCommissioningQueue,
  summarizeSideHustleCommissioning,
} from './side-hustle-commissioning.js'
import {getSideHustleProductionStatus} from './side-hustle-production-status.js'

const queue=listSideHustleCommissioningQueue()
const summary=summarizeSideHustleCommissioning(queue)
const affiliate=queue.find(item=>item.family==='commerce_affiliate')
assert.ok(affiliate)
assert.equal(affiliate.readiness,'live_candidate')
for(const gate of ['provider','credential','live_customer','payment_billing','data_analytics','compliance'] as const){
  assert.ok(affiliate.gateTypes.includes(gate),`affiliate commissioning missing ${gate}`)
}

assert.equal(summary.totalFamilies,26)
assert.equal(summary.commercialFamilies,25)
assert.equal(summary.softwareReadyCommercialFamilies,25)
assert.equal(summary.validationOnlyFamilies,0)
assert.equal(summary.capabilityOnlyFamilies,1)
assert.ok(summary.liveCandidates>=2)
assert.equal(summary.externalActionAuthorized,false)
assert.equal(summary.moneyMovementAuthorized,false)

for(const item of queue){
  assert.equal(item.externalActionAuthorized,false)
  assert.equal(item.moneyMovementAuthorized,false)
  if(item.family==='trading_investing_intelligence'){
    assert.equal(item.softwareReady,false)
    assert.deepEqual(item.gateTypes,['capability_boundary'])
  }else{
    assert.equal(item.softwareReady,true)
    assert.ok(item.gateTypes.length>=1)
    assert.ok(item.gateTypes.includes('live_customer'))
  }
}

const pod=buildSideHustleCommissioningItem(getSideHustleProductionStatus('pod_personalized_commerce'))
assert.ok(pod.gateTypes.includes('provider'))
assert.ok(pod.gateTypes.includes('credential'))
assert.ok(pod.gateTypes.includes('physical_evidence'))

const dropshipping=buildSideHustleCommissioningItem(getSideHustleProductionStatus('dropshipping_product_commerce'))
assert.ok(dropshipping.gateTypes.includes('provider'))
assert.ok(dropshipping.gateTypes.includes('credential'))
assert.ok(dropshipping.gateTypes.includes('compliance'))

const human=buildSideHustleCommissioningItem(getSideHustleProductionStatus('human_premium_services'))
assert.ok(human.gateTypes.includes('human_operator'))

console.log('side hustle commissioning queue tests passed')
