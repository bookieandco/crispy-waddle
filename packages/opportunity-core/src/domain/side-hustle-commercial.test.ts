import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import { buildSideHustleProfile } from './side-hustles.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import {
  buildCommercialDeliveryRouting,
  buildCommercialServiceOutcome,
  certifySideHustleCommercialFamily,
  createCommercialWorkOrder,
  lockCommercialWorkOrderScope,
  recordCommercialAcceptance,
  recordCommercialDelivery,
  recordCommercialDeliveryStart,
} from './side-hustle-commercial.js'

const now='2026-10-02T20:00:00.000Z'
const opportunity:Opportunity={
  id:'opportunity:commercial:test',
  title:'Paid content operations pilot',
  family:'business',
  type:'commercial',
  description:'Operate a bounded content workflow for one customer.',
  sourceUrl:'https://example.test/commercial',
  sourceName:'Commercial fixture',
  claims:[],
  evidence:[{
    id:'evidence:opportunity',
    sourceId:'source:commercial',
    sourceUrl:'https://example.test/commercial',
    sourceName:'Commercial fixture',
    sourceType:'user',
    capturedAt:now,
    confidence:.9,
  }],
  verificationStatus:'unverified',
  sourceConfidence:.9,
  riskFlags:[],
  metadata:{
    sideHustleProfile:buildSideHustleProfile({
      family:'content_social',
      executionOwners:['growth','media'],
    }),
  },
  status:'ready',
  createdAt:now,
  updatedAt:now,
}

const draft=createCommercialWorkOrder({
  opportunity,
  id:'work-order:1',
  ventureId:'venture:1',
  customerRef:'relationship:customer:1',
  title:'Content operations pilot',
  outcomePromise:'Produce and deliver an approved evidence-backed content package.',
  scopeItems:[
    {
      id:'scope:strategy',
      title:'Content strategy',
      description:'Produce the bounded content plan.',
      evidenceRefs:['evidence:scope:strategy'],
    },
    {
      id:'scope:assets',
      title:'Creative assets',
      description:'Produce the approved creative package.',
      evidenceRefs:['evidence:scope:assets'],
    },
  ],
  acceptanceCriteria:[
    {id:'criterion:plan',description:'Customer approves the content plan.',required:true},
    {id:'criterion:assets',description:'Customer accepts the delivered asset package.',required:true},
  ],
  price:{amount:750,currency:'usd',cadence:'project'},
  evidenceRefs:['evidence:scope-agreement'],
  createdAt:now,
})
assert.equal(draft.status,'draft')
assert.equal(draft.authority,'COMMERCIAL_SCOPE_ONLY')
assert.equal(draft.externalActionAuthorized,false)
assert.equal(draft.paymentAuthorized,false)
assert.equal(draft.signatureAuthorized,false)
assert.deepEqual(draft.executionOwners,['growth','media'])

const locked=lockCommercialWorkOrderScope({
  workOrder:draft,
  evidenceRefs:['evidence:customer-scope-lock'],
  lockedAt:'2026-10-02T20:05:00.000Z',
})
assert.equal(locked.status,'scope_locked')

const routing=buildCommercialDeliveryRouting({
  workOrder:locked,
  ownerAssignments:[
    {
      executionOwner:'growth',
      scopeItemIds:['scope:strategy'],
      evidenceRefs:['evidence:routing:growth'],
      role:'lead',
    },
    {
      executionOwner:'media',
      scopeItemIds:['scope:assets'],
      evidenceRefs:['evidence:routing:media'],
      role:'support',
    },
  ],
  evidenceRefs:['evidence:routing-plan'],
  createdAt:'2026-10-02T20:06:00.000Z',
})
assert.equal(routing.blockers.length,0)
assert.equal(routing.unresolvedScopeItemIds.length,0)
assert.equal(routing.assignments.length,2)
assert.equal(routing.assignmentAuthorized,false)
assert.equal(routing.externalActionAuthorized,false)

const started=recordCommercialDeliveryStart({
  workOrder:locked,
  receiptId:'delivery-start:1',
  executionOwner:'growth',
  executionRef:'execution:growth:1',
  evidenceRefs:['evidence:execution-started'],
  startedAt:'2026-10-02T20:10:00.000Z',
})
assert.equal(started.workOrder.status,'delivery_in_progress')
assert.equal(started.receipt.externalActionAuthorized,false)

const delivered=recordCommercialDelivery({
  workOrder:started.workOrder,
  startReceipt:started.receipt,
  receiptId:'delivery:1',
  deliveryRef:'delivery-package:1',
  deliverableRefs:['artifact:plan','artifact:asset-pack'],
  evidenceRefs:['evidence:delivery'],
  deliveredAt:'2026-10-02T21:00:00.000Z',
})
assert.equal(delivered.workOrder.status,'delivered')

const accepted=recordCommercialAcceptance({
  workOrder:delivered.workOrder,
  deliveryReceipt:delivered.receipt,
  receiptId:'acceptance:1',
  customerRef:'relationship:customer:1',
  decision:'accepted',
  criteriaMet:['criterion:plan','criterion:assets'],
  criteriaMissed:[],
  evidenceRefs:['evidence:customer-acceptance'],
  observedAt:'2026-10-02T21:15:00.000Z',
})
assert.equal(accepted.workOrder.status,'accepted')
assert.equal(accepted.receipt.paymentAuthorized,false)

const outcome=buildCommercialServiceOutcome({
  opportunity,
  workOrder:accepted.workOrder,
  acceptanceReceipt:accepted.receipt,
  id:'outcome:commercial:1',
  result:'won',
  grossRevenue:750,
  refunds:0,
  directCosts:140,
  fees:25,
  hours:6,
  sourceOwner:'commerce',
  evidenceRefs:['evidence:payment'],
  transactionRefs:['transaction:payment:1'],
  actionRef:'action:commerce:1',
  executionRef:'execution:growth:1',
  observedAt:'2026-10-02T21:20:00.000Z',
})
assert.equal(outcome.outcome.profit,585)
assert.equal(outcome.outcome.margin,585/750)
assert.equal(outcome.authority,'CANONICAL_OUTCOME_INPUT_ONLY')
assert.equal(outcome.moneyMovementAuthorized,false)

const providerPlan:FulfillmentPlan={
  opportunityId:opportunity.id,
  structure:'specialist_vendor',
  assignments:[{
    providerId:'provider:editor',
    role:'specialist_vendor',
    requirementIds:['requirement:edit'],
    evidenceRefs:['evidence:provider:editor'],
    score:90,
  }],
  coveredRequirementIds:['requirement:edit'],
  uncoveredRequirementIds:[],
  blockers:[],
  rationale:['Specialist provider handles editing.'],
  requiresHumanApproval:true,
  engagementAuthorized:false,
}
const providerRouting=buildCommercialDeliveryRouting({
  workOrder:locked,
  ownerAssignments:[{
    executionOwner:'growth',
    scopeItemIds:['scope:strategy'],
    evidenceRefs:['evidence:routing:growth'],
    role:'lead',
  }],
  fulfillmentPlan:providerPlan,
  providerScopeItemIds:{'provider:editor':['scope:assets']},
  evidenceRefs:['evidence:routing-provider'],
  createdAt:'2026-10-02T20:07:00.000Z',
})
assert.equal(providerRouting.blockers.length,0)
assert.equal(providerRouting.assignments.some(row=>row.targetType==='fulfillment_provider'),true)
assert.equal(providerRouting.assignments.every(row=>row.assignmentAuthorized===false),true)

assert.throws(()=>recordCommercialAcceptance({
  workOrder:delivered.workOrder,
  deliveryReceipt:delivered.receipt,
  receiptId:'acceptance:bad',
  customerRef:'relationship:customer:1',
  decision:'accepted',
  criteriaMet:['criterion:plan'],
  criteriaMissed:['criterion:assets'],
  evidenceRefs:['evidence:bad-acceptance'],
  observedAt:'2026-10-02T21:15:00.000Z',
}),/every required acceptance criterion/)

assert.throws(()=>recordCommercialDeliveryStart({
  workOrder:locked,
  receiptId:'delivery-start:bad-owner',
  executionOwner:'unknown-owner',
  executionRef:'execution:unknown',
  evidenceRefs:['evidence:start'],
  startedAt:'2026-10-02T20:10:00.000Z',
}),/not registered/)

const blockedRouting=buildCommercialDeliveryRouting({
  workOrder:locked,
  ownerAssignments:[{
    executionOwner:'growth',
    scopeItemIds:['scope:strategy'],
    evidenceRefs:['evidence:routing:growth'],
  }],
  evidenceRefs:['evidence:routing-incomplete'],
  createdAt:'2026-10-02T20:07:00.000Z',
})
assert.deepEqual(blockedRouting.unresolvedScopeItemIds,['scope:assets'])
assert.equal(blockedRouting.blockers.length,1)

const software={
  workOrderBound:true,
  deliveryAcceptanceBound:true,
  canonicalOutcomeBridgeBound:true,
  operatorRoutingBound:true,
  canonicalOutcomeAuthorityPreserved:true,
  actionAuthorityExternal:true,
  moneyAuthorityExternal:true,
  automaticMaturityPromotionDisabled:true,
  duplicateAuthorityPaths:0,
}
const blockedCertification=certifySideHustleCommercialFamily({
  family:'content_social',
  software,
  live:{
    lockedWorkOrders:1,
    observedDeliveries:1,
    acceptedDeliveries:0,
    realizedPaidOutcomes:0,
    routingPlans:1,
    unauthorizedExternalActions:0,
    unauthorizedPayments:0,
    automaticMaturityPromotions:0,
  },
})
assert.equal(blockedCertification.softwareStatus,'pass')
assert.equal(blockedCertification.liveStatus,'blocked')
assert.equal(blockedCertification.status,'blocked')

const passingCertification=certifySideHustleCommercialFamily({
  family:'content_social',
  software,
  live:{
    lockedWorkOrders:1,
    observedDeliveries:1,
    acceptedDeliveries:1,
    realizedPaidOutcomes:1,
    routingPlans:1,
    unauthorizedExternalActions:0,
    unauthorizedPayments:0,
    automaticMaturityPromotions:0,
  },
})
assert.equal(passingCertification.status,'pass')
assert.equal(passingCertification.externalActionAuthorized,false)
assert.equal(passingCertification.moneyMovementAuthorized,false)
assert.equal(passingCertification.automaticMaturityPromotionAuthorized,false)

const capabilityCertification=certifySideHustleCommercialFamily({
  family:'trading_investing_intelligence',
  software,
  live:{
    lockedWorkOrders:0,
    observedDeliveries:0,
    acceptedDeliveries:0,
    realizedPaidOutcomes:0,
    routingPlans:0,
    unauthorizedExternalActions:0,
    unauthorizedPayments:0,
    automaticMaturityPromotions:0,
  },
})
assert.equal(capabilityCertification.status,'not_applicable')

const capabilityOpportunity:Opportunity={
  ...opportunity,
  id:'opportunity:capability',
  metadata:{sideHustleProfile:buildSideHustleProfile({family:'trading_investing_intelligence'})},
}
assert.throws(()=>createCommercialWorkOrder({
  opportunity:capabilityOpportunity,
  id:'work-order:capability',
  customerRef:'customer:test',
  title:'Not allowed',
  outcomePromise:'Not allowed',
  scopeItems:[{
    id:'scope:test',
    title:'Test',
    description:'Test',
    evidenceRefs:['evidence:test'],
  }],
  acceptanceCriteria:[{id:'criterion:test',description:'Test',required:true}],
  price:{amount:1,currency:'USD',cadence:'one_time'},
  evidenceRefs:['evidence:test'],
  createdAt:now,
}),/Capability-only/)

console.log('side hustle commercial .1-.5 tests passed')
