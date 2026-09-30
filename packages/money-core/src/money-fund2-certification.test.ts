import test from 'node:test'
import assert from 'node:assert/strict'
import {
 ActionExecutor,
 InMemoryActionLedger,
 InMemoryApprovalReceiptStore,
 createApprovalReceiptVerifier,
} from '@jhadina/action-core'
import {
 createMoneyMovementActionPolicy,
 MoneyMovementExecutionHandler,
 type MoneyMovementExecutionContext,
} from './funding-action-core-handler.js'
import {
 executeGovernedMoneyMovement,
 reconcileMoneyMovement,
 type MoneyMovementAttempt,
 type MoneyMovementAttemptStore,
 type ExecutingFundingRailAdapter,
 type FundingRailAdmission,
 type FundingRailRuntimeObservation,
} from './funding-execution-contracts.js'
import {
 type FundingDestination,
 type MoneyMovementProposal,
 type MoneyMovementRequest,
} from './funding-rail-contracts.js'
import {
 fingerprintMoneyMovementApproval,
 moneyMovementApprovalRequest,
 moneyMovementExecutionRequest,
} from './money-movement-approval-contracts.js'
import type { ExecutionPermit,PermitStore } from './execution-permit.js'
import type { FundingRailCommissioningCertificate } from './funding-provider-commissioning.js'

const commissioningCertificate:FundingRailCommissioningCertificate=Object.freeze({
 certificateId:'fund-cert:1',railId:'rail:fixture',provider:'funding-fixture',providerAccountId:'acct-live-1',evidenceClass:'REAL_LIVE',status:'CONTROLLED_CANARY_CERTIFIED',
 controlledCanaryCertified:true,liveCertified:false,admittedKinds:Object.freeze(['DEPOSIT','WITHDRAWAL','TRANSFER'] as const),admittedCurrencies:Object.freeze(['USD']),
 sourceKinds:Object.freeze(['BANK','BROKER_CASH'] as const),destinationKinds:Object.freeze(['BANK','BROKER_CASH'] as const),maxMovementMinor:10000n,maxDailyMovementMinor:20000n,
 reasonCodes:Object.freeze([]),receiptIds:Object.freeze(['r1']),canaryIds:Object.freeze([]),evidenceIds:Object.freeze(['cert:e1']),recordedAt:'2026-09-27T23:00:00Z',authority:'CERTIFICATION_ONLY',canExecute:false,
})

const source:FundingDestination=Object.freeze({destinationId:'bank:owner',ownerUserId:'u1',provider:'plaid',accountId:'bank-1',currency:'USD',verified:true,kind:'BANK',evidenceIds:Object.freeze(['bank:e1'])})
const destination:FundingDestination=Object.freeze({destinationId:'coffer:c1',ownerUserId:'u1',provider:'money-core',accountId:'c1',currency:'USD',verified:true,kind:'BROKER_CASH',evidenceIds:Object.freeze(['coffer:e1'])})
const proposal:MoneyMovementProposal=Object.freeze({movementId:'movement:1',kind:'DEPOSIT',userId:'u1',cofferId:'c1',amountMinor:2500n,currency:'USD',sourceId:source.destinationId,destinationId:destination.destinationId,idempotencyKey:'movement:1:idem',requestedAt:'2026-09-27T23:00:00Z',state:'PENDING_APPROVAL',authority:'PROPOSAL_ONLY',canMoveMoney:false})

const admission=(o:Partial<FundingRailAdmission>={}):FundingRailAdmission=>Object.freeze({
 railId:'rail:fixture',provider:'funding-fixture',environment:'LIVE',admission:'CONTROLLED_CANARY',allowedKinds:Object.freeze(['DEPOSIT','WITHDRAWAL','TRANSFER'] as const),allowedCurrencies:Object.freeze(['USD'] as const),
 sourceKinds:Object.freeze(['BANK','BROKER_CASH'] as const),destinationKinds:Object.freeze(['BANK','BROKER_CASH'] as const),maxMovementMinor:10000n,maxDailyMovementMinor:20000n,commissioningCertificateId:commissioningCertificate.certificateId,
 evidenceIds:Object.freeze(['rail:e1']),authority:'ADMISSION_ONLY',canMoveMoney:false,...o,
})
const observation=(o:Partial<FundingRailRuntimeObservation>={}):FundingRailRuntimeObservation=>Object.freeze({railId:'rail:fixture',movedTodayMinor:0n,unresolvedAttemptCount:0,observedAt:'2026-09-27T23:00:01Z',evidenceIds:Object.freeze(['runtime:e1']),authority:'RUNTIME_EVIDENCE',...o})

class PermitMemoryStore implements PermitStore{
 rows=new Map<string,ExecutionPermit>()
 issue(p:ExecutionPermit){this.rows.set(p.permitId,p)}
 get(id:string){return this.rows.get(id)}
 consume(id:string,nonce:string){const p=this.rows.get(id);if(!p||p.state!=='ISSUED'||p.nonce!==nonce)return false;this.rows.set(id,Object.freeze({...p,state:'CONSUMED'}));return true}
 revoke(id:string){const p=this.rows.get(id);if(p)this.rows.set(id,Object.freeze({...p,state:'REVOKED'}))}
 haltAll(){for(const [id,p] of this.rows)if(p.state==='ISSUED')this.rows.set(id,Object.freeze({...p,state:'HALTED'}))}
}
class AttemptMemoryStore implements MoneyMovementAttemptStore{
 rows=new Map<string,MoneyMovementAttempt>()
 get(id:string){return this.rows.get(id)}
 start(a:MoneyMovementAttempt){if(this.rows.has(a.attemptId))throw new Error('duplicate');this.rows.set(a.attemptId,a)}
 complete(id:string,update:Pick<MoneyMovementAttempt,'state'|'providerReference'|'completedAt'|'recoveryRequired'|'evidenceIds'>){const p=this.rows.get(id);if(!p)throw new Error('missing');this.rows.set(id,Object.freeze({...p,...update}))}
}

function adapter(state:'SETTLED'|'UNKNOWN'='SETTLED',calls:{submit:number}={submit:0}):ExecutingFundingRailAdapter{
 return {
  provider:'funding-fixture',environment:'LIVE',capabilities:Object.freeze({deposit:true,withdrawal:true,transfer:true}),
  async quote(r){return Object.freeze({quoteId:'q:'+r.movementId,movementId:r.movementId,provider:'funding-fixture',amountMinor:r.amountMinor,feeMinor:100n,currency:r.currency,expiresAt:'2026-09-28T00:00:00Z',evidenceIds:Object.freeze(['quote:e1']),authority:'QUOTE_ONLY',canMoveMoney:false})},
  async prepareInstruction(r,q){return Object.freeze({instructionId:'i:'+r.movementId,movementId:r.movementId,provider:q.provider,providerAccountId:'provider-account',kind:r.kind,amountMinor:r.amountMinor,currency:r.currency,sourceId:r.sourceId,destinationId:r.destinationId,idempotencyKey:r.idempotencyKey,approvalRequired:true,reconciliationRequired:true,authority:'PROVIDER_INSTRUCTION_ONLY',canMoveMoney:false})},
  async submitInstruction({request,instruction}){calls.submit++;return Object.freeze({eventId:'event:'+calls.submit,providerEventId:'provider-event:'+calls.submit,provider:'funding-fixture',movementId:request.movementId,instructionId:instruction.instructionId,state,providerReference:state==='UNKNOWN'?undefined:'provider-ref:1',amountMinor:request.amountMinor,feeMinor:100n,currency:request.currency,occurredAt:'2026-09-27T23:00:05Z',observedAt:'2026-09-27T23:00:06Z',evidenceIds:Object.freeze(['provider:e1']),authority:'EVIDENCE_ONLY'})},
 }
}

test('MONEY-FUND.2 provider choice changes downstream request but not owner-approved economics fingerprint',()=>{
 const approval=moneyMovementApprovalRequest(proposal)
 const a=moneyMovementExecutionRequest({proposal,approvalReceiptId:'receipt:1',provider:'rail-a',railId:'a'})
 const b=moneyMovementExecutionRequest({proposal,approvalReceiptId:'receipt:1',provider:'rail-b',railId:'b'})
 assert.equal(fingerprintMoneyMovementApproval(approval),fingerprintMoneyMovementApproval(a))
 assert.equal(fingerprintMoneyMovementApproval(a),fingerprintMoneyMovementApproval(b))
 assert.notEqual(a.action.provider,b.action.provider)
})

test('MONEY-FUND.2 uncommissioned rail denies before approval consumption',async()=>{
 const approvalStore=new InMemoryApprovalReceiptStore()
 const approvalRequest=moneyMovementApprovalRequest(proposal)
 const pending=await approvalStore.createPending({actionId:approvalRequest.id,userId:approvalRequest.userId,type:approvalRequest.type,fingerprint:fingerprintMoneyMovementApproval(approvalRequest),expiresAt:'2099-01-01T00:00:00Z'})
 await approvalStore.approve(pending.id,'u1')
 const request=moneyMovementExecutionRequest({proposal,approvalReceiptId:pending.id,provider:'funding-fixture',railId:'rail:fixture'})
 const ctx:MoneyMovementExecutionContext=Object.freeze({proposal,source,destination,admission:admission({admission:'UNCOMMISSIONED'}),observation:observation(),adapter:adapter(),commissioningCertificate})
 const policy=createMoneyMovementActionPolicy({async load(){return ctx}})
 assert.equal(await policy.evaluate(request),'deny')
 const stillConsumable=await approvalStore.consume(pending.id,{actionId:approvalRequest.id,userId:'u1',type:approvalRequest.type,fingerprint:fingerprintMoneyMovementApproval(approvalRequest)})
 assert.equal(stillConsumable,true)
})

test('MONEY-FUND.2 canonical chain consumes receipt and permit then submits provider exactly once',async()=>{
 const calls={submit:0},rail=adapter('SETTLED',calls),permits=new PermitMemoryStore(),attempts=new AttemptMemoryStore()
 const ctx:MoneyMovementExecutionContext=Object.freeze({proposal,source,destination,admission:admission(),commissioningCertificate,observation:observation(),adapter:rail})
 const loader={async load(){return ctx}}
 const approvalStore=new InMemoryApprovalReceiptStore(),approvalRequest=moneyMovementApprovalRequest(proposal)
 const pending=await approvalStore.createPending({actionId:approvalRequest.id,userId:approvalRequest.userId,type:approvalRequest.type,fingerprint:fingerprintMoneyMovementApproval(approvalRequest),expiresAt:'2099-01-01T00:00:00Z'})
 await approvalStore.approve(pending.id,'u1')
 const request=moneyMovementExecutionRequest({proposal,approvalReceiptId:pending.id,provider:'funding-fixture',railId:'rail:fixture'})
 const handler=new MoneyMovementExecutionHandler({loader,permitStore:permits,attempts,now:()=> '2026-09-27T23:00:02Z',policyVersion:'fund2:v1',policyHash:'fund2-policy-hash',authorityId:()=> 'authority:movement:1',permitId:()=> 'permit:movement:1',permitNonce:()=> 'nonce:movement:1'})
 const executor=new ActionExecutor(createMoneyMovementActionPolicy(loader),new InMemoryActionLedger(),[handler],createApprovalReceiptVerifier(approvalStore,fingerprintMoneyMovementApproval))
 const result=await executor.execute(request)
 assert.equal(result.attempt.state,'SETTLED')
 assert.equal(calls.submit,1)
 assert.equal(permits.get('permit:movement:1')?.state,'CONSUMED')
 await assert.rejects(()=>executor.execute(request),/Invalid approval receipt/)
 assert.equal(calls.submit,1)
})

test('MONEY-FUND.2 UNKNOWN provider evidence blocks deterministic replay of the same permit/instruction attempt',async()=>{
 const calls={submit:0},rail=adapter('UNKNOWN',calls),attempts=new AttemptMemoryStore()
 const request:MoneyMovementRequest=Object.freeze({movementId:proposal.movementId,kind:proposal.kind,userId:proposal.userId,cofferId:proposal.cofferId,amountMinor:proposal.amountMinor,currency:proposal.currency,sourceId:proposal.sourceId,destinationId:proposal.destinationId,idempotencyKey:proposal.idempotencyKey,requestedAt:proposal.requestedAt,authorityId:'authority:1',executionPermitId:'permit:1'})
 const q=await rail.quote(request),i=await rail.prepareInstruction(request,q)
 const first=await executeGovernedMoneyMovement({request,source,destination,quote:q,instruction:i,admission:admission(),commissioningCertificate,observation:observation(),adapter:rail,attempts,now:'2026-09-27T23:00:02Z'})
 assert.equal(first.attempt.state,'UNKNOWN')
 assert.equal(first.attempt.recoveryRequired,true)
 await assert.rejects(()=>executeGovernedMoneyMovement({request,source,destination,quote:q,instruction:i,admission:admission(),commissioningCertificate,observation:observation(),adapter:rail,attempts,now:'2026-09-27T23:00:03Z'}),/ATTEMPT_ALREADY_IN_FLIGHT_OR_UNKNOWN/)
 assert.equal(calls.submit,1)
})

test('MONEY-FUND.2 settlement reconciliation understands source-added and destination-deducted fees',()=>{
 const request:MoneyMovementRequest=Object.freeze({movementId:proposal.movementId,kind:proposal.kind,userId:proposal.userId,cofferId:proposal.cofferId,amountMinor:2500n,currency:'USD',sourceId:proposal.sourceId,destinationId:proposal.destinationId,idempotencyKey:proposal.idempotencyKey,requestedAt:proposal.requestedAt,authorityId:'authority:1',executionPermitId:'permit:1'})
 const sourceAdded=reconcileMoneyMovement(request,Object.freeze({settlementId:'s1',movementId:request.movementId,amountMinor:2500n,feeMinor:100n,feeApplication:'SOURCE_ADDED',sourceBeforeMinor:10000n,sourceAfterMinor:7400n,destinationBeforeMinor:1000n,destinationAfterMinor:3500n,observedAt:'2026-09-27T23:10:00Z',evidenceIds:Object.freeze(['settlement:e1']),authority:'SETTLEMENT_EVIDENCE'}))
 assert.equal(sourceAdded.passed,true)
 const destDeducted=reconcileMoneyMovement(request,Object.freeze({settlementId:'s2',movementId:request.movementId,amountMinor:2500n,feeMinor:100n,feeApplication:'DESTINATION_DEDUCTED',sourceBeforeMinor:10000n,sourceAfterMinor:7500n,destinationBeforeMinor:1000n,destinationAfterMinor:3400n,observedAt:'2026-09-27T23:10:00Z',evidenceIds:Object.freeze(['settlement:e2']),authority:'SETTLEMENT_EVIDENCE'}))
 assert.equal(destDeducted.passed,true)
 const bad=reconcileMoneyMovement(request,Object.freeze({settlementId:'s3',movementId:request.movementId,amountMinor:2500n,feeMinor:100n,feeApplication:'SOURCE_ADDED',sourceBeforeMinor:10000n,sourceAfterMinor:7500n,destinationBeforeMinor:1000n,destinationAfterMinor:3500n,observedAt:'2026-09-27T23:10:00Z',evidenceIds:Object.freeze(['settlement:e3']),authority:'SETTLEMENT_EVIDENCE'}))
 assert.equal(bad.passed,false)
 assert.ok(bad.reasonCodes.includes('SOURCE_DELTA_MISMATCH'))
})


test('MONEY-FUND.2 pre-submit failure revokes unused permit and never calls provider submit',async()=>{
 const calls={submit:0},base=adapter('SETTLED',calls)
 const broken:ExecutingFundingRailAdapter={...base,async quote(){throw new Error('QUOTE_DOWN')}}
 const permits=new PermitMemoryStore(),attempts=new AttemptMemoryStore()
 const ctx:MoneyMovementExecutionContext=Object.freeze({proposal,source,destination,admission:admission(),commissioningCertificate,observation:observation(),adapter:broken})
 const loader={async load(){return ctx}}
 const approvalStore=new InMemoryApprovalReceiptStore(),approvalRequest=moneyMovementApprovalRequest(proposal)
 const pending=await approvalStore.createPending({actionId:approvalRequest.id,userId:approvalRequest.userId,type:approvalRequest.type,fingerprint:fingerprintMoneyMovementApproval(approvalRequest),expiresAt:'2099-01-01T00:00:00Z'})
 await approvalStore.approve(pending.id,'u1')
 const request=moneyMovementExecutionRequest({proposal,approvalReceiptId:pending.id,provider:'funding-fixture',railId:'rail:fixture'})
 const handler=new MoneyMovementExecutionHandler({loader,permitStore:permits,attempts,now:()=> '2026-09-27T23:00:02Z',policyVersion:'fund2:v1',policyHash:'fund2-policy-hash',authorityId:()=> 'authority:movement:quote-fail',permitId:()=> 'permit:movement:quote-fail',permitNonce:()=> 'nonce:movement:quote-fail'})
 const executor=new ActionExecutor(createMoneyMovementActionPolicy(loader),new InMemoryActionLedger(),[handler],createApprovalReceiptVerifier(approvalStore,fingerprintMoneyMovementApproval))
 await assert.rejects(()=>executor.execute(request),/QUOTE_DOWN/)
 assert.equal(permits.get('permit:movement:quote-fail')?.state,'REVOKED')
 assert.equal(calls.submit,0)
 assert.equal(attempts.rows.size,0)
})
