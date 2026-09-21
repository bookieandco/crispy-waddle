import assert from 'node:assert/strict'
import test from 'node:test'
import type { ExecutionAttempt,ExecutionAttemptOutcome,ExecutionAttemptStore } from './execution-attempt.js'
import { fingerprintAction,type ExecutionAction } from './execution-permit.js'
import { assertRecoveryChildLineage } from './recovery-child-execution.js'

class Store implements ExecutionAttemptStore{
 constructor(private rows=new Map<string,ExecutionAttempt>()){}
 start(a:ExecutionAttempt){this.rows.set(a.attemptId,a)}
 complete(_id:string,_o:ExecutionAttemptOutcome){}
 resolve(_id:string,_o:ExecutionAttemptOutcome){}
 get(id:string){return this.rows.get(id)}
}
const action:ExecutionAction={actionId:'req',userId:'user',capability:'money.payment.create',provider:'bank',accountId:'acct',payeeId:'payee',amount:'10',currency:'USD'}
const base=(id:string,over:Partial<ExecutionAttempt>={}):ExecutionAttempt=>{
 const snapshot=over.actionSnapshot??action
 return {attemptId:id,requestId:'req',permitId:'permit',actionFingerprint:fingerprintAction(snapshot),actionSnapshot:snapshot,provider:'bank',operation:'money.payment.create',idempotencyKey:id,state:'RECOVERY_REQUIRED',startedAt:'2026-09-19T00:00:00Z',completedAt:'2026-09-19T00:00:01Z',recoveryRequired:true,...over}
}
const rejects=async(parent:ExecutionAttempt,child:ExecutionAttempt,code:string,extra:ExecutionAttempt[]=[])=>assert.rejects(()=>assertRecoveryChildLineage(new Store(new Map([parent,...extra].map(x=>[x.attemptId,x]))),{parentExecutionId:parent.attemptId,child}),new RegExp(code))

test('accepts a valid recovery child',async()=>{const p=base('p');const c=base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p'});assert.equal((await assertRecoveryChildLineage(new Store(new Map([['p',p]])),{parentExecutionId:'p',child:c})).attemptId,'p')})
test('rejects forged parent',async()=>{const p=base('p');await rejects(p,base('c',{recoveryOfExecutionId:'other'}),'PARENT_LINEAGE_MISMATCH')})
test('rejects changed economic fingerprint',async()=>{const p=base('p');const changed={...action,amount:'999'};await rejects(p,base('c',{recoveryOfExecutionId:'p',actionSnapshot:changed,actionFingerprint:fingerprintAction(changed)}),'ACTION_FINGERPRINT_MISMATCH')})
test('rejects snapshot/fingerprint tampering',async()=>{const p=base('p');await rejects(p,base('c',{recoveryOfExecutionId:'p',actionFingerprint:'forged'}),'ACTION_SNAPSHOT_MISMATCH')})
test('rejects provider and operation drift',async()=>{const p=base('p');const otherProvider={...action,provider:'other'};await rejects(p,base('c',{recoveryOfExecutionId:'p',actionSnapshot:otherProvider,actionFingerprint:fingerprintAction(otherProvider),provider:'other'}),'ACTION_FINGERPRINT_MISMATCH');const otherOperation={...action,capability:'money.transfer.create'};await rejects(p,base('c2',{recoveryOfExecutionId:'p',actionSnapshot:otherOperation,actionFingerprint:fingerprintAction(otherOperation),operation:'money.transfer.create'}),'ACTION_FINGERPRINT_MISMATCH')})
test('rejects missing ancestor',async()=>{const p=base('p',{recoveryOfExecutionId:'missing'});await rejects(p,base('c',{recoveryOfExecutionId:'p'}),'ANCESTOR_NOT_FOUND')})
test('rejects lineage cycle',async()=>{const p=base('p',{recoveryOfExecutionId:'a'});const a=base('a',{recoveryOfExecutionId:'p'});await rejects(p,base('c',{recoveryOfExecutionId:'p'}),'LINEAGE_CYCLE',[a])})
test('allows recovery generation three',async()=>{const root=base('root');const p1=base('p1',{recoveryOfExecutionId:'root'});const p2=base('p2',{recoveryOfExecutionId:'p1'});const c=base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p2'});assert.equal((await assertRecoveryChildLineage(new Store(new Map([root,p1,p2].map(x=>[x.attemptId,x]))),{parentExecutionId:'p2',child:c})).attemptId,'p2')})
test('rejects recovery generation four',async()=>{const root=base('root');const p1=base('p1',{recoveryOfExecutionId:'root'});const p2=base('p2',{recoveryOfExecutionId:'p1'});const p3=base('p3',{recoveryOfExecutionId:'p2'});await rejects(p3,base('c',{recoveryOfExecutionId:'p3'}),'GENERATION_LIMIT',[p2,p1,root])})
