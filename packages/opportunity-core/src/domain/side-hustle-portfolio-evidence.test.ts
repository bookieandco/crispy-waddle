import assert from 'node:assert/strict'
import type {CommercialWorkOrder} from './side-hustle-commercial.js'
import {reviewSideHustlePortfolioCommercialEvidence, type PortfolioCommercialReceipt} from './side-hustle-portfolio-evidence.js'

const time='2026-10-15T18:00:00.000Z'
const order:CommercialWorkOrder={
  id:'order:1',opportunityId:'op:1',family:'research_services',
  customerRef:'customer:1',title:'Research report',outcomePromise:'Original cited brief',
  scopeItems:[{id:'brief',title:'Brief',description:'Research and deliver',evidenceRefs:['source:brief']}],
  acceptanceCriteria:[{id:'citations',description:'Customer accepts citations',required:true}],
  price:{amount:100,currency:'USD',cadence:'project'},executionOwners:['opportunity'],
  evidenceRefs:['customer:scope'],status:'accepted',
  createdAt:'2026-10-15T17:00:00.000Z',updatedAt:time,
  scopeLockedAt:'2026-10-15T17:10:00.000Z',acceptedAt:time,
  authority:'COMMERCIAL_SCOPE_ONLY',externalActionAuthorized:false,paymentAuthorized:false,signatureAuthorized:false,
}
function receipt(kind:PortfolioCommercialReceipt['kind'],id:string,payload:unknown):PortfolioCommercialReceipt{
  return {kind,id,family:'research_services',workOrderId:'order:1',opportunityId:'op:1',
    evidenceRefs:['real:'+id],payload,recordedAt:time}
}
const routing=receipt('routing','route:1',{
  id:'route:1',workOrderId:'order:1',opportunityId:'op:1',family:'research_services',
  blockers:[],unresolvedScopeItemIds:[],assignments:[{scopeItemIds:['brief'],assignmentAuthorized:false}],
  assignmentAuthorized:false,externalActionAuthorized:false,
})
const start=receipt('delivery_start','start:1',{
  id:'start:1',workOrderId:'order:1',opportunityId:'op:1',
  startedAt:'2026-10-15T17:20:00.000Z',executionOwner:'opportunity',executionRef:'execution:1',
  evidenceRefs:['source:start'],externalActionAuthorized:false,
})
const delivery=receipt('delivery','delivery:1',{
  id:'delivery:1',workOrderId:'order:1',opportunityId:'op:1',
  deliveredAt:'2026-10-15T17:40:00.000Z',executionOwner:'opportunity',executionRef:'execution:1',
  deliverableRefs:['file:report'],evidenceRefs:['source:delivery'],externalActionAuthorized:false,
})
const acceptance=receipt('acceptance','acceptance:1',{
  id:'acceptance:1',workOrderId:'order:1',opportunityId:'op:1',deliveryReceiptId:'delivery:1',
  customerRef:'customer:1',decision:'accepted',criteriaMet:['citations'],criteriaMissed:[],
  observedAt:'2026-10-15T17:50:00.000Z',evidenceRefs:['source:acceptance'],
  paymentAuthorized:false,
})
const bridge=receipt('outcome_bridge','bridge:1',{
  workOrderId:'order:1',opportunityId:'op:1',acceptanceReceiptId:'acceptance:1',
  authority:'CANONICAL_OUTCOME_INPUT_ONLY',moneyMovementAuthorized:false,
  outcome:{id:'outcome:1',opportunityId:'op:1',result:'won',grossRevenue:100,
    currency:'USD',sourceOwner:'commerce',transactionRefs:['txn:1'],
    evidenceRefs:['processor:receipt'],profit:80,netRevenue:100,refunds:0,
    directCosts:15,fees:5,observedAt:'2026-10-15T17:55:00.000Z'},
})
const receipts=[routing,start,delivery,acceptance,bridge]
const valid=reviewSideHustlePortfolioCommercialEvidence({family:'research_services',workOrders:[order],receipts})
assert.equal(valid.status,'ready_for_independent_verification')
assert.deepEqual(valid.linkedPaidWorkOrderIds,['order:1'])
assert.equal(valid.live.realizedPaidOutcomes,1)
assert.ok(valid.blockers.some(x=>/Independent provider settlement/.test(x)))
assert.equal(valid.moneyMovementAuthorized,false)

for (const corrupted of [
  receipts.filter(r=>r.kind!=='routing'),
  receipts.filter(r=>r.kind!=='delivery_start'),
  receipts.filter(r=>r.kind!=='acceptance'),
  receipts.map(r=>r.kind==='acceptance'?{...r,payload:{...(r.payload as object),deliveryReceiptId:'unrelated'}}:r),
  receipts.map(r=>r.kind==='outcome_bridge'?{...r,payload:{...(r.payload as object),acceptanceReceiptId:'unrelated'}}:r),
  receipts.map(r=>r.kind==='outcome_bridge'?{...r,payload:{...(r.payload as object),outcome:{...((r.payload as {outcome:object}).outcome),transactionRefs:[]}}}:r),
  receipts.map(r=>r.kind==='outcome_bridge'?{...r,payload:{...(r.payload as object),outcome:{...((r.payload as {outcome:object}).outcome),sourceOwner:'user'}}}:r),
  receipts.map(r=>r.kind==='outcome_bridge'?{...r,workOrderId:'other:order'}:r),
  receipts.map(r=>r.kind==='routing'?{...r,payload:{workOrderId:'order:1',opportunityId:'op:1'}}:r),
]) {
  const report=reviewSideHustlePortfolioCommercialEvidence({family:'research_services',workOrders:[order],receipts:corrupted})
  assert.equal(report.status,'awaiting_evidence')
  assert.equal(report.live.realizedPaidOutcomes,0)
}
const malicious=[...receipts,{...bridge,id:'authority:1',payload:{...bridge.payload as object,moneyMovementAuthorized:true}}]
const bad=reviewSideHustlePortfolioCommercialEvidence({family:'research_services',workOrders:[order],receipts:malicious})
assert.equal(bad.status,'awaiting_evidence')
assert.ok(bad.live.unauthorizedPayments>0)
const other=reviewSideHustlePortfolioCommercialEvidence({family:'research_services',workOrders:[order],receipts:[]})
assert.equal(other.status,'awaiting_evidence')
assert.equal(other.live.lockedWorkOrders,1)
const capability=reviewSideHustlePortfolioCommercialEvidence({family:'trading_investing_intelligence',workOrders:[order],receipts})
assert.equal(capability.status,'not_applicable')
assert.equal(capability.live.realizedPaidOutcomes,0)
console.log('side hustle portfolio commercial evidence tests passed')
