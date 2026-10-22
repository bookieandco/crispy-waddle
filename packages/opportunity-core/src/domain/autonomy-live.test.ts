import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import type { CommercialAcceptanceReceipt, CommercialDeliveryReceipt, CommercialWorkOrder } from './side-hustle-commercial.js'
import type { OpportunityOutcome } from './outcome.js'
import { buildSourceBoundInternalPilot, decideInternalPilotTransition, reviewPaidPilotEvidence } from './autonomy-live.js'

const t='2026-10-22T07:00:00.000Z'
const opportunity: Opportunity = {
  id:'opportunity:research:1', title:'Business research', family:'business', type:'commercial',
  sourceName:'Public example',sourceUrl:'https://a.example/info',
  claims:[], evidence:[
    {id:'a',sourceId:'public:a',sourceUrl:'https://a.example/info',sourceName:'A',sourceType:'official',capturedAt:t,excerpt:'Finding A',confidence:0.8},
    {id:'b',sourceId:'public:b',sourceUrl:'https://b.example/info',sourceName:'B',sourceType:'official',capturedAt:t,excerpt:'Finding B',confidence:0.8},
  ], verificationStatus:'unverified',sourceConfidence:0.8,riskFlags:[],status:'discovered', createdAt:t,updatedAt:t,
}
const observations=[
  {id:'one',opportunityId:opportunity.id,sourceUrl:'https://a.example/info',evidenceId:'a',excerpt:'Finding A',observedAt:t,reviewedByOwner:true},
  {id:'two',opportunityId:opportunity.id,sourceUrl:'https://b.example/info',evidenceId:'b',excerpt:'Finding B',observedAt:t,reviewedByOwner:true},
]
const pilot={kind:'research_report' as const,subject:'Business research',createdAt:'2026-10-22T07:10:00.000Z',evidence:observations.map(o=>({sourceUrl:o.sourceUrl,observedAt:o.observedAt,finding:o.excerpt}))}
const ok=buildSourceBoundInternalPilot({opportunity,pilot,observations})
assert.equal(ok.admitted,true)
assert.equal(ok.externalActionAuthorized,false)
assert.equal(ok.draft?.paidOutcomeVerified,false)
assert.equal(buildSourceBoundInternalPilot({opportunity,pilot,observations:[{...observations[0],excerpt:'Altered text'},observations[1]]}).admitted,false)
assert.equal(buildSourceBoundInternalPilot({opportunity,pilot,observations:[{...observations[0],reviewedByOwner:false},observations[1]]}).admitted,false)

const queued={id:'pilot:1',ownerId:'owner:1',opportunityId:opportunity.id,stage:'queued' as const,attempt:0,maxAttempts:2,receiptRefs:[],version:0}
const claimed=decideInternalPilotTransition({current:queued,ownerId:'owner:1',expectedVersion:0,command:'claim',now:t,leaseToken:'lease:1'})
assert.equal(claimed.stage,'running')
assert.equal(claimed.attempt,1)
assert.throws(()=>decideInternalPilotTransition({current:claimed,ownerId:'owner:1',expectedVersion:1,command:'claim',now:t,leaseToken:'lease:2'}),/not claimable/)
assert.throws(()=>decideInternalPilotTransition({current:claimed,ownerId:'owner:other',expectedVersion:1,command:'draft_ready',now:t,leaseToken:'lease:1',receiptRef:'receipt:1'}),/Owner/)
assert.throws(()=>decideInternalPilotTransition({current:claimed,ownerId:'owner:1',expectedVersion:0,command:'draft_ready',now:t,leaseToken:'lease:1',receiptRef:'receipt:1'}),/version/)
assert.throws(()=>decideInternalPilotTransition({current:claimed,ownerId:'owner:1',expectedVersion:1,command:'draft_ready',now:t,leaseToken:'wrong',receiptRef:'receipt:1'}),/lease/)
const review=decideInternalPilotTransition({current:claimed,ownerId:'owner:1',expectedVersion:1,command:'draft_ready',now:t,leaseToken:'lease:1',receiptRef:'draft:1'})
assert.equal(review.stage,'owner_review')
const done=decideInternalPilotTransition({current:review,ownerId:'owner:1',expectedVersion:2,command:'review_accepted',now:t,receiptRef:'review:1'})
assert.equal(done.stage,'internal_complete')
assert.throws(()=>decideInternalPilotTransition({current:done,ownerId:'owner:1',expectedVersion:3,command:'retry',now:t}),/Terminal/)

const workOrder={id:'work:1',opportunityId:opportunity.id,customerRef:'customer:1',price:{amount:100,currency:'USD',cadence:'one_time'}} as CommercialWorkOrder
const delivery={id:'del:1',workOrderId:'work:1',opportunityId:opportunity.id} as CommercialDeliveryReceipt
const acceptance={id:'acc:1',workOrderId:'work:1',opportunityId:opportunity.id,customerRef:'customer:1',decision:'accepted'} as CommercialAcceptanceReceipt
const money={id:'outcome:1',opportunityId:opportunity.id,currency:'USD',grossRevenue:100,sourceOwner:'money_core',result:'won',transactionRefs:['tx:1']} as OpportunityOutcome
const neverPretend=reviewPaidPilotEvidence({workOrder,delivery,acceptance,outcome:money,moneyVerifiedByIndependentRead:true})
assert.equal(neverPretend.status,'ready_for_independent_verification')
assert.equal(neverPretend.recognizedRevenue,0)
assert.equal(neverPretend.paymentRecorded,false)
assert.equal(reviewPaidPilotEvidence({workOrder,delivery,acceptance,outcome:money,moneyVerifiedByIndependentRead:false}).status,'blocked')
assert.equal(reviewPaidPilotEvidence({workOrder,delivery,acceptance:{...acceptance,customerRef:'someone-else'},outcome:money,moneyVerifiedByIndependentRead:true}).status,'blocked')
assert.equal(reviewPaidPilotEvidence({workOrder,delivery,acceptance,outcome:{...money,sourceOwner:'user',transactionRefs:[]},moneyVerifiedByIndependentRead:true}).status,'blocked')
console.log('OCE live source, queue and commercial acceptance gates passed')
