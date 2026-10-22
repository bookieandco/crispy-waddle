import assert from 'node:assert/strict'
import { assessDiscoverySchedule, type OpportunityDiscoverySchedule } from './autonomy-discovery-schedule.js'

const t='2026-10-22T08:00:00.000Z'
const input:OpportunityDiscoverySchedule={
  id:'schedule:1',ownerId:'owner:1',boards:[{source:'greenhouse',board:'acme'},{source:'lever',board:'test'}],
  approvalReceiptId:'owner:decision:001',ownerApprovedAt:'2026-10-21T08:00:00Z',
  providerTermsReviewedAt:'2026-10-21T08:15:00Z',
  expiresAt:'2026-10-29T08:00:00Z',
  intervalMinutes:120,maxFindingsPerCycle:25,paused:false,
}
const due=assessDiscoverySchedule(input,t)
assert.equal(due.state,'due')
assert.equal(due.canonicalIngestAuthorized,false)
assert.equal(due.estimatedThirdPartyCostUsd,0)
assert.equal(due.externalActionAuthorized,false)
const notDue=assessDiscoverySchedule({...input,lastCycleAt:'2026-10-22T07:00:00Z'},t)
assert.equal(notDue.state,'not_due')
assert.equal(assessDiscoverySchedule({...input,intervalMinutes:5},t).state,'blocked')
assert.equal(assessDiscoverySchedule({...input,approvalReceiptId:''},t).state,'blocked')
assert.equal(assessDiscoverySchedule({...input,paused:true},t).state,'blocked')
assert.equal(assessDiscoverySchedule({...input,expiresAt:'2026-10-22T07:59:59Z'},t).state,'blocked')
assert.equal(assessDiscoverySchedule({...input,boards:Array(6).fill({source:'lever',board:'acme'})},t).state,'blocked')
assert.equal(assessDiscoverySchedule({...input,maxFindingsPerCycle:100},t).state,'blocked')
assert.equal(assessDiscoverySchedule({...input,ownerApprovedAt:'2026-10-23T08:00:00Z'},t).state,'blocked')
console.log('OCE standing discovery schedule admission tests passed')
