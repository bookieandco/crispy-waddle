import {describe,expect,it} from 'vitest'
import {
  buildSideHustleProfile,
  calculateOpportunityOutcome,
  createCommercialWorkOrder,
  lockCommercialWorkOrderScope,
  type DropServicingRecord,
  type Opportunity,
  type OpportunityOutcome,
} from '@jhadina/opportunity-core'
import type {StoredDropServicingRecord} from './supabase-opportunity-repository'
import {
  buildDropServicingMarginRuntime,
  planDropServicingProviderAssignmentRuntime,
  recordDropServicingIssueRuntime,
  recordDropServicingProviderQuoteRuntime,
  summarizeDropServicingRuntime,
  type DropServicingPersistence,
} from './side-hustle-drop-servicing-runtime'

const now='2026-10-03T17:30:00.000Z'

function fixture(){
  const opportunity:Opportunity={
    id:'opportunity:drop-runtime',title:'Drop service runtime',family:'business',type:'commercial',
    sourceName:'drop runtime test',sourceUrl:'https://example.test/drop-runtime',
    claims:[],evidence:[],verificationStatus:'unverified',sourceConfidence:.9,riskFlags:[],
    metadata:{sideHustleProfile:buildSideHustleProfile({family:'drop_servicing'})},
    status:'ready',createdAt:now,updatedAt:now,
  }
  let workOrder=createCommercialWorkOrder({
    opportunity,id:'work-order:drop:1',customerRef:'customer:1',title:'Video editing',
    outcomePromise:'Deliver approved edits.',
    scopeItems:[
      {id:'scope:edit',title:'Edit',description:'Edit videos.',evidenceRefs:['evidence:scope']},
      {id:'scope:captions',title:'Captions',description:'Add captions.',evidenceRefs:['evidence:scope']},
    ],
    acceptanceCriteria:[{id:'criterion:final',description:'Finals accepted.',required:true}],
    price:{amount:1000,currency:'USD',cadence:'project'},
    evidenceRefs:['evidence:client'],createdAt:now,
  })
  workOrder=lockCommercialWorkOrderScope({
    workOrder,evidenceRefs:['evidence:lock'],lockedAt:'2026-10-03T17:31:00.000Z',
  })
  const outcomes=new Map<string,OpportunityOutcome>()
  const records=new Map<string,StoredDropServicingRecord>()
  const repository:DropServicingPersistence={
    async getSideHustleCommercialWorkOrder(id){return id===workOrder.id?workOrder:undefined},
    async getOutcome(id){return outcomes.get(id)},
    async getDropServicingRecord(id){return records.get(id)},
    async listDropServicingRecords(input={}){
      return [...records.values()].filter(row=>
        (!input.opportunityId||row.opportunityId===input.opportunityId)&&
        (!input.workOrderId||row.workOrderId===input.workOrderId)&&
        (!input.kind||row.kind===input.kind)
      )
    },
    async saveDropServicingRecord(kind,record){
      const id=('id'in record?record.id:undefined) as string|undefined
      if(!id)throw new Error('record id required')
      const anyRecord=record as any
      const recordedAt=anyRecord.observedAt??anyRecord.plannedAt??now
      records.set(id,{
        id,opportunityId:anyRecord.opportunityId,workOrderId:anyRecord.workOrderId,
        kind,providerRef:anyRecord.providerRef,payload:structuredClone(record) as DropServicingRecord,
        recordedAt,
      })
      return record
    },
  }
  return{repository,workOrder,outcomes,records}
}

describe('Drop Servicing runtime',()=>{
  it('persists quote, assignment, issue and margin evidence without minting authority',async()=>{
    const f=fixture()
    const quote=await recordDropServicingProviderQuoteRuntime({
      workOrderId:f.workOrder.id,id:'quote:1',providerRef:'provider:1',
      scopeItemIds:['scope:edit','scope:captions'],amount:350,currency:'USD',
      slaDueAt:'2026-10-05T17:30:00.000Z',revisionsIncluded:2,
      validUntil:'2026-10-04T17:30:00.000Z',
      evidenceRefs:['evidence:quote'],observedAt:'2026-10-03T17:32:00.000Z',
    },f.repository)
    expect(quote.assignmentAuthorized).toBe(false)

    const assignment=await planDropServicingProviderAssignmentRuntime({
      workOrderId:f.workOrder.id,quoteId:quote.id,id:'assignment:1',
      evidenceRefs:['evidence:assignment'],plannedAt:'2026-10-03T17:33:00.000Z',
    },f.repository)
    expect(assignment.externalActionAuthorized).toBe(false)

    const issue=await recordDropServicingIssueRuntime({
      workOrderId:f.workOrder.id,assignmentId:assignment.id,id:'issue:1',kind:'rework',
      deliveryRef:'delivery:provider:1',issue:'Caption timing is off.',
      requestedResolution:'Correct timing before customer delivery.',
      evidenceRefs:['evidence:issue'],observedAt:'2026-10-04T17:30:00.000Z',
    },f.repository)
    expect(issue.paymentAuthorized).toBe(false)

    const outcome=calculateOpportunityOutcome({
      id:'outcome:drop:1',opportunityId:f.workOrder.opportunityId,result:'won',
      currency:'USD',grossRevenue:1000,refunds:0,directCosts:400,fees:30,hours:3,
      sourceOwner:'commerce',evidenceRefs:['evidence:payment'],
      observedAt:'2026-10-06T17:30:00.000Z',
    })
    f.outcomes.set(outcome.id,outcome)

    const margin=await buildDropServicingMarginRuntime({
      workOrderId:f.workOrder.id,outcomeId:outcome.id,assignmentIds:[assignment.id],
      id:'margin:1',evidenceRefs:['evidence:margin'],
    },f.repository)
    expect(margin.providerCost).toBe(350)
    expect(margin.grossMargin).toBe(570)
    expect(margin.moneyMovementAuthorized).toBe(false)

    const summary=await summarizeDropServicingRuntime({workOrderId:f.workOrder.id},f.repository)
    expect(summary).toMatchObject({
      quotes:1,assignmentPlans:1,issues:1,marginModels:1,
      externalActionAuthorized:false,assignmentAuthorized:false,paymentAuthorized:false,
    })
  })
})
