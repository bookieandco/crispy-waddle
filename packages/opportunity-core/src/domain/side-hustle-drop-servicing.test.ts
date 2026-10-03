import assert from 'node:assert/strict'
import {buildSideHustleProfile} from './side-hustles.js'
import {createCommercialWorkOrder,lockCommercialWorkOrderScope} from './side-hustle-commercial.js'
import {calculateOpportunityOutcome} from './outcome.js'
import type {Opportunity} from './opportunity.js'
import {
  buildDropServicingMarginModel,
  dropServicingRecordKind,
  planDropServicingProviderAssignment,
  recordDropServicingIssue,
  recordDropServicingProviderQuote,
} from './side-hustle-drop-servicing.js'

const now='2026-10-03T17:00:00.000Z'
const opportunity:Opportunity={
  id:'opportunity:drop-service:1',title:'Drop service',family:'business',type:'commercial',
  sourceName:'drop servicing test',sourceUrl:'https://example.test/drop-service',
  claims:[],evidence:[],verificationStatus:'unverified',sourceConfidence:.9,riskFlags:[],
  metadata:{sideHustleProfile:buildSideHustleProfile({family:'drop_servicing'})},
  status:'ready',createdAt:now,updatedAt:now,
}
let workOrder=createCommercialWorkOrder({
  opportunity,id:'work-order:1',customerRef:'customer:1',title:'Editing package',
  outcomePromise:'Deliver edited videos',
  scopeItems:[
    {id:'scope:edit',title:'Editing',description:'Edit source videos.',evidenceRefs:['evidence:scope']},
    {id:'scope:captions',title:'Captions',description:'Create captions.',evidenceRefs:['evidence:scope']},
  ],
  acceptanceCriteria:[{id:'accepted',description:'Finals accepted.',required:true}],
  price:{amount:1000,currency:'USD',cadence:'project'},evidenceRefs:['evidence:client'],
  createdAt:now,
})
workOrder=lockCommercialWorkOrderScope({workOrder,evidenceRefs:['evidence:lock'],lockedAt:'2026-10-03T17:01:00.000Z'})

const quote=recordDropServicingProviderQuote({
  workOrder,id:'quote:1',providerRef:'provider:1',scopeItemIds:['scope:edit','scope:captions'],
  amount:350,currency:'usd',slaDueAt:'2026-10-05T17:00:00.000Z',revisionsIncluded:2,
  validUntil:'2026-10-04T17:00:00.000Z',evidenceRefs:['evidence:quote'],observedAt:'2026-10-03T17:02:00.000Z',
})
assert.equal(dropServicingRecordKind(quote),'provider_quote')
assert.equal(quote.assignmentAuthorized,false)

const assignment=planDropServicingProviderAssignment({
  workOrder,quote,id:'assignment:1',evidenceRefs:['evidence:plan'],plannedAt:'2026-10-03T17:03:00.000Z',
})
assert.equal(dropServicingRecordKind(assignment),'provider_assignment')
assert.equal(assignment.paymentAuthorized,false)

const issue=recordDropServicingIssue({
  workOrder,assignment,id:'issue:1',kind:'rework',deliveryRef:'delivery:provider:1',
  issue:'Caption timing missed acceptance criteria.',requestedResolution:'Correct caption timing.',
  evidenceRefs:['evidence:rework'],observedAt:'2026-10-04T17:00:00.000Z',
})
assert.equal(dropServicingRecordKind(issue),'provider_issue')
assert.equal(issue.externalActionAuthorized,false)

const outcome=calculateOpportunityOutcome({
  id:'outcome:1',opportunityId:opportunity.id,result:'won',currency:'USD',
  grossRevenue:1000,refunds:0,directCosts:400,fees:30,hours:3,sourceOwner:'commerce',
  evidenceRefs:['evidence:payment'],observedAt:'2026-10-06T17:00:00.000Z',
})
const margin=buildDropServicingMarginModel({
  workOrder,assignments:[assignment],outcome,evidenceRefs:['evidence:margin'],
})
assert.equal(dropServicingRecordKind(margin),'margin_model')
assert.equal(margin.providerCost,350)
assert.equal(margin.otherDirectCosts,50)
assert.equal(margin.grossMargin,570)
assert.equal(margin.grossMarginPct,57)
assert.equal(margin.moneyMovementAuthorized,false)

console.log('side hustle drop servicing tests passed')
