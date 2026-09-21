import assert from 'node:assert/strict'
import test from 'node:test'
import type { ActionRequest } from '@jhadina/action-core'
import { createMoneyActionCoreAuthority,issueActionCoreBoundExecutionPermit } from './action-core-authority-bridge.js'
import { createExecutionAttempt,type ExecutionAttempt,type ExecutionAttemptOutcome,type ExecutionAttemptStore } from './execution-attempt.js'
import type { ExecutionPermit,PermitStore } from './execution-permit.js'
import type { MoneyExecutionPermit } from './execution-permit-gate.js'
import { recoveryEvidenceHash } from './postgres-execution-recovery-ledger.js'
import type { RecoveryObservation } from './execution-recovery.js'
import { MoneyRecoveryChildExecutor } from './recovery-child-executor.js'
import type { RecoveryRetryEvidenceStore } from './recovery-retry-evidence.js'

type Payment={capability:'money.payment.create';provider:string;accountId:string;amount:number;currency:string;payeeId:string}
const payment:Payment={capability:'money.payment.create',provider:'bank',accountId:'acct',amount:10,currency:'USD',payeeId:'payee'}
const request:ActionRequest<Payment>={id:'req',userId:'user',type:payment.capability,action:payment,requestedAt:'2026-09-19T00:00:00Z',approvalReceiptId:'approval-retry'}
const executionAction={actionId:'req',userId:'user',capability:payment.capability,provider:'bank',accountId:'acct',payeeId:'payee',amount:'10',currency:'USD'} as const

class Attempts implements ExecutionAttemptStore{
 rows=new Map<string,ExecutionAttempt>()
 start(a:ExecutionAttempt){if(this.rows.has(a.attemptId))throw new Error('DUPLICATE');this.rows.set(a.attemptId,{...a})}
 complete(id:string,o:ExecutionAttemptOutcome,at='2026-09-19T00:02:00Z'){const a=this.rows.get(id);if(!a)throw new Error('MISSING');this.rows.set(id,{...a,...o,completedAt:at})}
 resolve(id:string,o:ExecutionAttemptOutcome,at='2026-09-19T00:02:00Z'){this.complete(id,o,at)}
 get(id:string){return this.rows.get(id)}
}
class Permits implements PermitStore{
 rows=new Map<string,ExecutionPermit>()
 issue(p:ExecutionPermit){this.rows.set(p.permitId,p)}
 get(id:string){return this.rows.get(id)}
 consume(id:string,nonce:string){const p=this.rows.get(id);if(!p||p.nonce!==nonce||p.state!=='ISSUED')return false;this.rows.set(id,Object.freeze({...p,state:'CONSUMED' as const}));return true}
 revoke(){}
 haltAll(){}
}
class Evidence implements RecoveryRetryEvidenceStore{
 constructor(public observation?:RecoveryObservation){}
 getLatestObservation(){return this.observation}
}
function parent():ExecutionAttempt{
 const a=createExecutionAttempt({attemptId:'parent',requestId:'req',permitId:'permit-parent',action:executionAction,operation:payment.capability,now:'2026-09-19T00:00:01Z'})
 return {...a,state:'RECOVERY_REQUIRED',recoveryRequired:true,completedAt:'2026-09-19T00:00:02Z'}
}
function observation(p:ExecutionAttempt,state:RecoveryObservation['observedState']='NOT_FOUND'):RecoveryObservation{
 const raw={executionId:p.attemptId,proposalHash:p.actionFingerprint,providerOperation:p.operation,observedState:state,evidence:{provider:'bank',lookup:'canonical'},adapterId:'bank-reconciler',adapterVersion:1,checkedAt:'2026-09-19T00:01:00Z'}
 return {...raw,evidenceHash:recoveryEvidenceHash(raw)}
}
function freshPermit(store:Permits):MoneyExecutionPermit{
 const authority=createMoneyActionCoreAuthority(request,{authorityId:'authority-retry',decision:'approval_required',policyVersion:'v1',policyHash:'h1',authorizedAt:'2026-09-19T00:00:03Z',expiresAt:'2026-09-19T00:10:00Z'})
 const p=issueActionCoreBoundExecutionPermit(request,executionAction,authority,{expiresAt:'2026-09-19T00:05:00Z',now:'2026-09-19T00:00:04Z',permitId:'permit-retry',nonce:'nonce-retry'})
 store.issue(p)
 return {permitId:p.permitId,nonce:p.nonce,authorityId:p.binding.authorityId,actionRequestFingerprint:p.binding.actionRequestFingerprint,policyVersion:p.binding.policyVersion,policyHash:p.binding.policyHash,approvalId:p.binding.approvalId}
}
function harness(state:RecoveryObservation['observedState']='NOT_FOUND'){
 const attempts=new Attempts(),p=parent();attempts.rows.set(p.attemptId,p)
 const permits=new Permits(),permit=freshPermit(permits),evidence=new Evidence(observation(p,state));let providerCalls=0
 const executor=new MoneyRecoveryChildExecutor({attempts,permitStore:permits,retryEvidence:evidence,async executeProvider(child,identity){providerCalls+=1;assert.equal(identity.executionId,child.attemptId);assert.equal(identity.actionFingerprint,p.actionFingerprint);return{providerReference:'retry-ref'}}})
 return{attempts,p,permits,permit,evidence,executor,calls:()=>providerCalls}
}
test('retry requires NOT_FOUND evidence and a fresh consumed permit before provider I/O',async()=>{const h=harness();const out=await h.executor.execute({parentExecutionId:'parent',attemptId:'child',request,permit:h.permit,now:'2026-09-19T00:00:05Z'});assert.equal(out.providerReference,'retry-ref');assert.equal(h.calls(),1);assert.equal(h.permits.get('permit-retry')?.state,'CONSUMED');const child=h.attempts.get('child');assert.equal(child?.recoveryOfExecutionId,'parent');assert.equal(child?.state,'SUCCEEDED');assert.notEqual(child?.permitId,h.p.permitId)})
test('missing retry-safe evidence fails before permit consumption or provider I/O',async()=>{const h=harness();h.evidence.observation=undefined;await assert.rejects(()=>h.executor.execute({parentExecutionId:'parent',attemptId:'child',request,permit:h.permit,now:'2026-09-19T00:00:05Z'}),/RETRY_EVIDENCE_REQUIRED/);assert.equal(h.permits.get('permit-retry')?.state,'ISSUED');assert.equal(h.calls(),0)})
test('pending or unknown evidence never authorizes retry',async()=>{for(const state of ['PENDING','UNKNOWN'] as const){const h=harness(state);await assert.rejects(()=>h.executor.execute({parentExecutionId:'parent',attemptId:'child',request,permit:h.permit,now:'2026-09-19T00:00:05Z'}),/RETRY_NOT_SAFE/);assert.equal(h.calls(),0)}})
test('parent permit cannot be replayed as retry authority',async()=>{const h=harness();const reused={...h.permit,permitId:h.p.permitId};await assert.rejects(()=>h.executor.execute({parentExecutionId:'parent',attemptId:'child',request,permit:reused,now:'2026-09-19T00:00:05Z'}),/FRESH_PERMIT_REQUIRED/);assert.equal(h.calls(),0)})
test('mutated retry economics fail before permit consumption',async()=>{const h=harness();const mutated={...request,action:{...payment,amount:999}};await assert.rejects(()=>h.executor.execute({parentExecutionId:'parent',attemptId:'child',request:mutated,permit:h.permit,now:'2026-09-19T00:00:05Z'}),/AUTH_ACTION_MISMATCH:amount/);assert.equal(h.permits.get('permit-retry')?.state,'ISSUED');assert.equal(h.calls(),0)})
