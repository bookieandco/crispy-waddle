import assert from 'node:assert/strict'
import { assessZeroRigServiceSandbox } from './zero-rig-service-sandbox.js'
import { assessZeroRigAction, denyZeroRigExternalExecution, type ZeroRigActionKind } from './zero-rig-governance.js'
import { projectZeroRigDashboard } from './zero-rig-dashboard.js'
import { evaluateZeroRigPaperPilot, type ZeroRigPaperDay } from './zero-rig-paper-pilot.js'
import { calculateOpportunityOutcome } from './outcome.js'

const now = '2026-10-17T20:00:00.000Z'
const service = {
  id: 'risk-report',title:'Read-only public token contract risk report',publicDataOnly:true,
  rightsCleared:true,containsPrivateData:false,proposedPriceCents:50,inferenceCentsPerCall:12,
  hostingCentsPerCall:2,platformAndSettlementCentsPerCall:3,fixedDailyHostingCents:80,
  estimatedDailyCalls:10,costEvidenceRefs:['price:source'],demandEvidenceRefs:['research:interest'],
  estimateObservedAt:now,limitCallsPerDay:50,
}
const good=assessZeroRigServiceSandbox(service,now)
assert.equal(good.verdict,'research_only')
assert.equal(good.netCentsPerCallBeforeFixed,33)
assert.equal(good.netCentsPerDay,250)
assert.equal(good.breakEvenDailyCalls,3)
assert.equal(good.customerPaymentsEnabled,false)
assert.equal(good.paidEndpointPublished,false)
assert.equal(assessZeroRigServiceSandbox({...service,containsPrivateData:true},now).verdict,'blocked')
assert.equal(assessZeroRigServiceSandbox({...service,rightsCleared:false},now).verdict,'blocked')
assert.equal(assessZeroRigServiceSandbox({...service,estimateObservedAt:null},now).verdict,'insufficient_data')
assert.equal(assessZeroRigServiceSandbox({...service,demandEvidenceRefs:[]},now).verdict,'insufficient_data')
assert.equal(assessZeroRigServiceSandbox({...service,proposedPriceCents:2},now).verdict,'blocked')
assert.equal(assessZeroRigServiceSandbox({...service,estimatedDailyCalls:60},now).verdict,'insufficient_data')
assert.equal(assessZeroRigServiceSandbox({...service,proposedPriceCents:0},now).verdict,'blocked')
const actions:ZeroRigActionKind[]=[
  'research_read','paper_draft','register_agent','submit_bounty','claim_reward',
  'publish_paid_api','accept_payment','buy_compute','transfer_tokens','run_miner',
  'activate_bandwidth_share',
]
for(const action of actions){
  const r=assessZeroRigAction(action)
  assert.equal(r.actionAuthorized,false)
  assert.equal(r.fundsAuthorized,false)
  assert.equal(r.requiresOwnerApproval,true)
  assert.equal(r.policyRequired,true)
  assert.equal(r.verdict,action==='research_read'||action==='paper_draft'?'local_research_only':'blocked_external_action')
  assert.throws(()=>denyZeroRigExternalExecution(action),/ZERO_RIG_EXTERNAL_ACTION_UNAUTHORIZED/)
}
const start='2026-10-01'
const asOf='2026-10-17T20:00:00.000Z'
const day=(date:string):ZeroRigPaperDay=>({
  date,mode:'paper',simulatedGrossUsd:20,simulatedCostUsd:4,
  simulatedEffortHours:2,simulatedOpportunitiesReviewed:3,evidenceRefs:['fixture:offline'],
})
const seven=Array.from({length:7},(_,i)=>day('2026-10-0'+(i+1)))
const empty=evaluateZeroRigPaperPilot({experimentId:'test-1',startDate:start,asOf,observations:[]})
assert.equal(empty.status,'paper_planned')
assert.equal(empty.simulatedNetUsd,null)
assert.equal(empty.actualRevenueUsd,null)
assert.equal(empty.daily.length,7)
const partial=evaluateZeroRigPaperPilot({experimentId:'test-1',startDate:start,asOf,observations:seven.slice(0,3)})
assert.equal(partial.status,'paper_incomplete')
assert.equal(partial.observedDays,3)
const finished=evaluateZeroRigPaperPilot({experimentId:'test-1',startDate:start,asOf,observations:seven})
assert.equal(finished.status,'paper_evaluated')
assert.equal(finished.simulatedNetUsd,112)
assert.equal(finished.simulatedUsdPerHour,8)
assert.equal(finished.spendingAuthorized,false)
assert.equal(finished.actualRevenueUsd,null)
assert.throws(()=>evaluateZeroRigPaperPilot({experimentId:'test-1',startDate:start,asOf,observations:[seven[0],seven[0]]}),/INVALID_PAPER_OBSERVATION/)
assert.throws(()=>evaluateZeroRigPaperPilot({experimentId:'test-1',startDate:start,asOf,observations:[day('2026-10-09')]}),/INVALID_PAPER_OBSERVATION/)
assert.throws(()=>evaluateZeroRigPaperPilot({experimentId:'test-1',startDate:start,asOf:'2026-09-30T00:00:00Z',observations:[seven[0]]}),/INVALID_PAPER_OBSERVATION/)
assert.throws(()=>evaluateZeroRigPaperPilot({experimentId:'test-1',startDate:start,asOf,observations:[{...seven[0],evidenceRefs:[]}]}),/INVALID_PAPER_OBSERVATION/)
const money=calculateOpportunityOutcome({
  id:'m-1',opportunityId:'zero-rig:superteam:b1',result:'won',currency:'USDC',
  grossRevenue:20,directCosts:2,hours:1,sourceOwner:'money_core',evidenceRefs:['verified:receipt'],
  transactionRefs:['onchain:txid'],observedAt:asOf,
})
const unaudited=calculateOpportunityOutcome({
  id:'m-2',opportunityId:'zero-rig:superteam:b2',result:'won',currency:'USD',
  grossRevenue:999,directCosts:0,hours:1,sourceOwner:'user',evidenceRefs:['claim:user'],
  observedAt:asOf,
})
const dashboard=projectZeroRigDashboard({
  outcomes:[money,money,unaudited],
  pending:[{id:'p1',currency:'PI',amount:99999,sourceRef:'unconfirmed:device'}],pilot:finished,
})
assert.equal(dashboard.verifiedPayoutCount,1)
assert.equal(dashboard.excludedUnverifiedCount,2)
assert.deepEqual(dashboard.payoutsByCurrency,[{currency:'USDC',netRevenue:20,profit:18,count:1}])
assert.equal(dashboard.pendingRewardCount,1)
assert.equal(dashboard.pendingRewardTotalUnpriced,true)
assert.equal(dashboard.pilot?.simulatedNetUsd,112)
assert.equal(dashboard.walletConnected,false)
assert.equal(dashboard.claimEnabled,false)
assert.equal(dashboard.transferEnabled,false)
const noData=projectZeroRigDashboard({outcomes:[],pending:[]})
assert.equal(noData.verifiedPayoutCount,0)
assert.deepEqual(noData.payoutsByCurrency,[])
assert.equal(noData.moneyCoreConnected,false)
console.log('JH-ZERO-RIG.05-.08 offline tests passed; no external execution')
