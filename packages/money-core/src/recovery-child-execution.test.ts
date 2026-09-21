import assert from 'node:assert/strict'
import test from 'node:test'
import { fingerprintAction,type ExecutionAction } from './execution-permit.js'
import type { ExecutionAttempt,ExecutionAttemptOutcome,ExecutionAttemptStore } from './execution-attempt.js'
import { assertRecoveryChildLineage } from './recovery-child-execution.js'

class Store implements ExecutionAttemptStore{
 constructor(private rows=new Map<string,ExecutionAttempt>()){}
 start(a:ExecutionAttempt){this.rows.set(a.attemptId,a)}
 complete(_id:string,_o:ExecutionAttemptOutcome){}
 resolve(_id:string,_o:ExecutionAttemptOutcome){}
 get(id:string){return this.rows.get(id)}
}
const action=(over:Partial<ExecutionAction>={}):ExecutionAction=>({actionId:'req',userId:'user',capability:'money.payment.create',provider:'bank',accountId:'acct',payeeId:'payee',amount:'10',currency:'USD',...over})
const base=(id:string,over:Partial<ExecutionAttempt>={},snapshot:ExecutionAction=action()):ExecutionAttempt=>({attemptId:id,requestId:'req',permitId:'permit-'+id,actionFingerprint:fingerprintAction(snapshot),actionSnapshot:snapshot,provider:snapshot.provider,operation:snapshot.capability,idempotencyKey:id,state:'RECOVERY_REQUIRED',startedAt:'2026-09-19T00:00:00Z',completedAt:'2026-09-19T00:00:01Z',recoveryRequired:true,...over})
const rejects=async(parent:ExecutionAttempt,child:ExecutionAttempt,code:string,extra:ExecutionAttempt[]=[])=>assert.rejects(()=>assertRecoveryChildLineage(new Store(new Map([parent,...extra].map(x=>[x.attemptId,x]))),{parentExecutionId:parent.attemptId,child}),new RegExp(code))

test('accepts a valid recovery child',async()=>{const p=base('p');const c=base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p'});assert.equal((await assertRecoveryChildLineage(new Store(new Map([['p',p]])),{parentExecutionId:'p',child:c})).attemptId,'p')})
test('rejects forged parent',async()=>{const p=base('p');await rejects(p,base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'other'}),'PARENT_LINEAGE_MISMATCH')})
test('rejects changed economic fingerprint',async()=>{const p=base('p');const changed=action({amount:'11'});await rejects(p,base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p'},changed),'ACTION_FINGERPRINT_MISMATCH')})
test('rejects tampered action snapshot even when recorded fingerprint is unchanged',async()=>{const p=base('p');const c=base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p',actionFingerprint:p.actionFingerprint},action({amount:'999'}));await rejects(p,c,'ACTION_SNAPSHOT_MISMATCH')})
test('rejects provider and operation drift',async()=>{const p=base('p');const provider=action({provider:'other'});await rejects(p,base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p'},provider),'ACTION_FINGERPRINT_MISMATCH');const operation=action({capability:'money.transfer.create'});await rejects(p,base('c2',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p'},operation),'ACTION_FINGERPRINT_MISMATCH')})
test('rejects missing ancestor',async()=>{const p=base('p',{recoveryOfExecutionId:'missing'});await rejects(p,base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p'}),'ANCESTOR_NOT_FOUND')})
test('rejects lineage cycle',async()=>{const p=base('p',{recoveryOfExecutionId:'a'});const a=base('a',{recoveryOfExecutionId:'p'});await rejects(p,base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p'}),'LINEAGE_CYCLE',[a])})
test('allows exactly three recovery generations',async()=>{const root=base('root');const p1=base('p1',{recoveryOfExecutionId:'root'});const p2=base('p2',{recoveryOfExecutionId:'p1'});const c=base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p2'});await assert.doesNotReject(()=>assertRecoveryChildLineage(new Store(new Map([root,p1,p2].map(x=>[x.attemptId,x]))),{parentExecutionId:'p2',child:c}))})
test('rejects fourth recovery generation',async()=>{const root=base('root');const p1=base('p1',{recoveryOfExecutionId:'root'});const p2=base('p2',{recoveryOfExecutionId:'p1'});const p3=base('p3',{recoveryOfExecutionId:'p2'});await rejects(p3,base('c',{state:'STARTED',completedAt:undefined,recoveryRequired:false,recoveryOfExecutionId:'p3'}),'GENERATION_LIMIT',[p2,p1,root])})
