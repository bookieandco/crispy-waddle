import { describe, expect, it } from 'vitest'
import {
  buildSideHustleProfile,
  calculateOpportunityOutcome,
  type CommercialWorkOrder,
  type Opportunity,
  type OpportunityOutcome,
} from '@jhadina/opportunity-core'
import type { StoredCanonicalOpportunity } from './canonical'
import type {
  SideHustleCommercialReceiptKind,
  SideHustleCommercialReceiptPayload,
  StoredSideHustleCommercialReceipt,
} from './supabase-opportunity-repository'
import {
  buildSideHustleCommercialRoutingRuntime,
  certifySideHustleCommercialFamilyRuntime,
  createSideHustleCommercialWorkOrderFromTemplateRuntime,
  createSideHustleCommercialWorkOrderRuntime,
  linkSideHustleCommercialOutcomeRuntime,
  lockSideHustleCommercialScopeRuntime,
  recordSideHustleCommercialAcceptanceRuntime,
  recordSideHustleCommercialDeliveryRuntime,
  recordSideHustleCommercialDeliveryStartRuntime,
  type SideHustleCommercialPersistence,
} from './side-hustle-commercial-runtime'

const now='2026-10-02T20:00:00.000Z'

function fixture(){
  const opportunity:Opportunity={
    id:'opportunity:commercial:runtime',
    title:'Paid content operations pilot',
    family:'business',
    type:'commercial',
    sourceUrl:'https://example.test/commercial',
    sourceName:'Commercial fixture',
    claims:[],
    evidence:[],
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
  const stored:StoredCanonicalOpportunity={
    userId:'owner:test',
    opportunity,
    triageState:'saved',
  }
  const workOrders=new Map<string,CommercialWorkOrder>()
  const receipts:StoredSideHustleCommercialReceipt[]=[]
  const outcomes=new Map<string,OpportunityOutcome>()

  const repository:SideHustleCommercialPersistence={
    async get(id){return id===opportunity.id?stored:undefined},
    async getOutcome(id){return outcomes.get(id)},
    async getSideHustleCommercialWorkOrder(id){return workOrders.get(id)},
    async listSideHustleCommercialWorkOrders(opportunityId){
      return [...workOrders.values()].filter(row=>!opportunityId||row.opportunityId===opportunityId)
    },
    async saveSideHustleCommercialWorkOrder(workOrder){
      workOrders.set(workOrder.id,workOrder)
      return workOrder
    },
    async transitionSideHustleCommercialWorkOrder(input){
      const existing=receipts.find(row=>row.id===input.receipt.id)
      if(existing) expect(existing).toEqual(input.receipt)
      else receipts.push(input.receipt)
      workOrders.set(input.workOrder.id,input.workOrder)
      return {workOrder:input.workOrder,receipt:input.receipt.payload}
    },
    async listSideHustleCommercialReceipts(input={}){
      return receipts.filter(row=>
        (!input.opportunityId||row.opportunityId===input.opportunityId)&&
        (!input.workOrderId||row.workOrderId===input.workOrderId)&&
        (!input.family||row.family===input.family)&&
        (!input.kind||row.kind===input.kind)
      )
    },
    async recordSideHustleCommercialReceipt(record){
      const existing=receipts.find(row=>row.id===record.id)
      if(existing){
        expect(existing).toEqual(record)
        return existing.payload
      }
      receipts.push(record)
      return record.payload
    },
  }

  return {repository,opportunity,workOrders,receipts,outcomes}
}

describe('Side Hustle commercial production runtime',()=>{
  it('creates a runnable work order directly from the family service template',async()=>{
    const f=fixture()
    const workOrder=await createSideHustleCommercialWorkOrderFromTemplateRuntime({
      opportunityId:f.opportunity.id,
      id:'work-order:runtime:template',
      customerRef:'relationship:customer:template',
      price:{amount:900,currency:'USD',cadence:'monthly'},
      evidenceRefs:['evidence:customer-intake'],
      createdAt:now,
    },f.repository)

    expect(workOrder.family).toBe('content_social')
    expect(workOrder.title).toBe('Content and social operations')
    expect(workOrder.scopeItems.map(item=>item.id)).toEqual(['strategy','production','delivery'])
    expect(workOrder.acceptanceCriteria.some(item=>item.id==='creative-approved'&&item.required)).toBe(true)
    expect(workOrder.evidenceRefs.some(ref=>ref.includes('side-hustle-service:content_social:v1'))).toBe(true)
    expect(workOrder.status).toBe('draft')
    expect(workOrder.externalActionAuthorized).toBe(false)
    expect(workOrder.paymentAuthorized).toBe(false)
  })

  it('persists the complete commercial evidence loop without minting authority',async()=>{
    const f=fixture()

    let workOrder=await createSideHustleCommercialWorkOrderRuntime({
      opportunityId:f.opportunity.id,
      id:'work-order:runtime:1',
      ventureId:undefined,
      customerRef:'relationship:customer:1',
      title:'Content operations pilot',
      outcomePromise:'Deliver an approved content package.',
      scopeItems:[
        {id:'scope:strategy',title:'Strategy',description:'Build content strategy.',evidenceRefs:['evidence:scope:strategy']},
        {id:'scope:assets',title:'Assets',description:'Build content assets.',evidenceRefs:['evidence:scope:assets']},
      ],
      acceptanceCriteria:[
        {id:'criterion:strategy',description:'Strategy accepted.',required:true},
        {id:'criterion:assets',description:'Assets accepted.',required:true},
      ],
      price:{amount:750,currency:'USD',cadence:'project'},
      evidenceRefs:['evidence:customer-scope'],
      createdAt:now,
    },f.repository)
    expect(workOrder.status).toBe('draft')
    expect(workOrder.externalActionAuthorized).toBe(false)

    workOrder=await lockSideHustleCommercialScopeRuntime({
      workOrderId:workOrder.id,
      evidenceRefs:['evidence:scope-lock'],
      lockedAt:'2026-10-02T20:05:00.000Z',
    },f.repository)
    expect(workOrder.status).toBe('scope_locked')

    const routing=await buildSideHustleCommercialRoutingRuntime({
      workOrderId:workOrder.id,
      ownerAssignments:[
        {executionOwner:'growth',scopeItemIds:['scope:strategy'],evidenceRefs:['evidence:route:growth'],role:'lead'},
        {executionOwner:'media',scopeItemIds:['scope:assets'],evidenceRefs:['evidence:route:media'],role:'support'},
      ],
      evidenceRefs:['evidence:routing'],
      createdAt:'2026-10-02T20:06:00.000Z',
    },f.repository)
    expect(routing.blockers).toEqual([])
    expect(routing.assignmentAuthorized).toBe(false)

    const started=await recordSideHustleCommercialDeliveryStartRuntime({
      workOrderId:workOrder.id,
      receiptId:'receipt:start:1',
      executionOwner:'growth',
      executionRef:'execution:growth:1',
      evidenceRefs:['evidence:start'],
      startedAt:'2026-10-02T20:10:00.000Z',
    },f.repository)
    expect(started.workOrder.status).toBe('delivery_in_progress')

    const delivered=await recordSideHustleCommercialDeliveryRuntime({
      workOrderId:workOrder.id,
      startReceiptId:started.receipt.id,
      receiptId:'receipt:delivery:1',
      deliveryRef:'delivery:package:1',
      deliverableRefs:['artifact:strategy','artifact:assets'],
      evidenceRefs:['evidence:delivered'],
      deliveredAt:'2026-10-02T21:00:00.000Z',
    },f.repository)
    expect(delivered.workOrder.status).toBe('delivered')

    const accepted=await recordSideHustleCommercialAcceptanceRuntime({
      workOrderId:workOrder.id,
      deliveryReceiptId:delivered.receipt.id,
      receiptId:'receipt:acceptance:1',
      customerRef:'relationship:customer:1',
      decision:'accepted',
      criteriaMet:['criterion:strategy','criterion:assets'],
      criteriaMissed:[],
      evidenceRefs:['evidence:accepted'],
      observedAt:'2026-10-02T21:10:00.000Z',
    },f.repository)
    expect(accepted.workOrder.status).toBe('accepted')

    const outcome=calculateOpportunityOutcome({
      id:'outcome:commercial:runtime:1',
      opportunityId:f.opportunity.id,
      result:'won',
      currency:'USD',
      grossRevenue:750,
      refunds:0,
      directCosts:140,
      fees:25,
      hours:6,
      sourceOwner:'commerce',
      evidenceRefs:['evidence:payment'],
      transactionRefs:['transaction:1'],
      executionRef:'execution:growth:1',
      observedAt:'2026-10-02T21:15:00.000Z',
    })
    f.outcomes.set(outcome.id,outcome)

    const bridge=await linkSideHustleCommercialOutcomeRuntime({
      workOrderId:workOrder.id,
      acceptanceReceiptId:accepted.receipt.id,
      outcomeId:outcome.id,
      recordedAt:'2026-10-02T21:16:00.000Z',
    },f.repository)
    expect(bridge.outcome.id).toBe(outcome.id)
    expect(bridge.moneyMovementAuthorized).toBe(false)

    const certification=await certifySideHustleCommercialFamilyRuntime({
      family:'content_social',
      certifiedAt:'2026-10-02T21:20:00.000Z',
    },f.repository)
    expect(certification.report.softwareStatus).toBe('pass')
    expect(certification.report.liveStatus).toBe('pass')
    expect(certification.report.status).toBe('pass')
    expect(certification.live.lockedWorkOrders).toBe(1)
    expect(certification.live.routingPlans).toBe(1)
    expect(certification.live.observedDeliveries).toBe(1)
    expect(certification.live.acceptedDeliveries).toBe(1)
    expect(certification.live.realizedPaidOutcomes).toBe(1)
    expect(certification.live.unauthorizedExternalActions).toBe(0)
    expect(certification.live.unauthorizedPayments).toBe(0)
    expect(certification.report.automaticMaturityPromotionAuthorized).toBe(false)

    expect(f.receipts.map(row=>row.kind)).toEqual([
      'routing',
      'delivery_start',
      'delivery',
      'acceptance',
      'outcome_bridge',
      'certification',
    ])
  })

  it('keeps certification blocked without customer acceptance and canonical paid outcome',async()=>{
    const f=fixture()
    const workOrder=await createSideHustleCommercialWorkOrderRuntime({
      opportunityId:f.opportunity.id,
      id:'work-order:runtime:blocked',
      customerRef:'relationship:customer:2',
      title:'Blocked pilot',
      outcomePromise:'Deliver pilot.',
      scopeItems:[{id:'scope:1',title:'Scope',description:'Scope.',evidenceRefs:['evidence:scope']}],
      acceptanceCriteria:[{id:'criterion:1',description:'Accepted.',required:true}],
      price:{amount:100,currency:'USD',cadence:'project'},
      evidenceRefs:['evidence:work-order'],
      createdAt:now,
    },f.repository)
    await lockSideHustleCommercialScopeRuntime({
      workOrderId:workOrder.id,
      evidenceRefs:['evidence:scope-lock'],
      lockedAt:'2026-10-02T20:05:00.000Z',
    },f.repository)

    const certification=await certifySideHustleCommercialFamilyRuntime({
      family:'content_social',
      certifiedAt:'2026-10-02T21:20:00.000Z',
    },f.repository)
    expect(certification.report.softwareStatus).toBe('pass')
    expect(certification.report.liveStatus).toBe('blocked')
    expect(certification.report.status).toBe('blocked')
  })

  it('returns not_applicable for capability-only family certification',async()=>{
    const f=fixture()
    const certification=await certifySideHustleCommercialFamilyRuntime({
      family:'trading_investing_intelligence',
      certifiedAt:'2026-10-02T21:20:00.000Z',
    },f.repository)
    expect(certification.report.status).toBe('not_applicable')
    expect(certification.report.moneyMovementAuthorized).toBe(false)
  })

  it('does not accept a mismatched receipt kind lookup',async()=>{
    const f=fixture()
    const payload:SideHustleCommercialReceiptPayload={
      id:'receipt:fake',
      workOrderId:'work-order:fake',
      opportunityId:f.opportunity.id,
      executionOwner:'growth',
      executionRef:'execution:1',
      evidenceRefs:['evidence:1'],
      startedAt:now,
      authority:'OBSERVATION_ONLY',
      externalActionAuthorized:false,
    }
    const record:StoredSideHustleCommercialReceipt={
      id:'receipt:fake',
      workOrderId:'work-order:fake',
      opportunityId:f.opportunity.id,
      family:'content_social',
      kind:'delivery_start' as SideHustleCommercialReceiptKind,
      evidenceRefs:['evidence:1'],
      payload,
      recordedAt:now,
    }
    f.receipts.push(record)
    expect((await f.repository.listSideHustleCommercialReceipts({kind:'delivery'}))).toEqual([])
  })
})
