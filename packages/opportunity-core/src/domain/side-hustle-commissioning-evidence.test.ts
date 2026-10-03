import assert from 'node:assert/strict'
import {buildSideHustleCommissioningItem} from './side-hustle-commissioning.js'
import {
  createSideHustleCommissioningEvidence,
  evaluateSideHustleLiveCommissioning,
  summarizeLiveCommissioning,
} from './side-hustle-commissioning-evidence.js'
import {getSideHustleProductionStatus} from './side-hustle-production-status.js'

const now='2026-10-03T18:00:00.000Z'
const later='2026-10-05T18:00:00.000Z'

const podPlan=buildSideHustleCommissioningItem(getSideHustleProductionStatus('pod_personalized_commerce'))
const evidence=podPlan.gateTypes.map((gateType,index)=>createSideHustleCommissioningEvidence({
  id:`pod:${gateType}:${index}`,
  family:'pod_personalized_commerce',
  gateType,
  status:'passed',
  providerRef:gateType==='provider'?'printify':undefined,
  evidenceRefs:[`evidence:${gateType}`],
  observedAt:now,
  expiresAt:gateType==='credential'?'2026-10-04T18:00:00.000Z':undefined,
}))

const certified=evaluateSideHustleLiveCommissioning({
  family:'pod_personalized_commerce',
  evidence,
  evaluatedAt:now,
})
assert.equal(certified.status,'certified')
assert.ok(certified.certifiedAt)
assert.equal(certified.externalActionAuthorized,false)

const reopened=evaluateSideHustleLiveCommissioning({
  family:'pod_personalized_commerce',
  evidence,
  evaluatedAt:later,
})
assert.equal(reopened.status,'commissioning')
assert.equal(reopened.gates.find(g=>g.gateType==='credential')?.status,'pending')

const blockedEvidence=createSideHustleCommissioningEvidence({
  id:'drop:provider:blocked',
  family:'dropshipping_product_commerce',
  gateType:'provider',
  status:'blocked',
  providerRef:'supplier:candidate',
  note:'Terms review failed.',
  evidenceRefs:['evidence:terms-review'],
  observedAt:now,
})
const blocked=evaluateSideHustleLiveCommissioning({
  family:'dropshipping_product_commerce',
  evidence:[blockedEvidence],
  evaluatedAt:now,
})
assert.equal(blocked.status,'blocked')
assert.equal(blocked.gates.find(g=>g.gateType==='provider')?.status,'blocked')

const capability=evaluateSideHustleLiveCommissioning({
  family:'trading_investing_intelligence',
  evidence:[],
  evaluatedAt:now,
})
assert.equal(capability.status,'not_applicable')
assert.deepEqual(capability.gates,[{gateType:'capability_boundary',status:'not_applicable'}])

const summary=summarizeLiveCommissioning([certified,blocked,capability])
assert.deepEqual(summary,{
  total:3,commercial:2,certified:1,blocked:1,commissioning:0,notApplicable:1,
  externalActionAuthorized:false,moneyMovementAuthorized:false,
})

assert.throws(()=>createSideHustleCommissioningEvidence({
  id:'pod:bad-gate',
  family:'pod_personalized_commerce',
  gateType:'human_operator',
  status:'passed',
  evidenceRefs:['evidence:bad'],
  observedAt:now,
}),/not required/)

console.log('side hustle commissioning evidence tests passed')
