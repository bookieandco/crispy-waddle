import assert from 'node:assert/strict'
import test from 'node:test'
import type { ExecutionAttempt,ExecutionAttemptOutcome,ExecutionAttemptStore } from './execution-attempt.js'
import { assertRecoveryChildLineage } from './recovery-child-execution.js'

class Store implements ExecutionAttemptStore{
 constructor(private rows=new Map<string,ExecutionAttempt>()){}
 start(a:ExecutionAttempt){this.rows.set(a.attemptId,a)}
 complete(_id:string,_o:ExecutionAttemptOutcome){}
 resolve(_id:string,_o:ExecutionAttemptOutcome){}
 get(id:string){return this.rows.get(id)}
}
const base=(id:string,over:Partial<ExecutionAttempt>={}):ExecutionAttempt=>({attemptId:id,requestId:'req',permitId:'permit',actionFingerprint:'fp',actionSnapshot:{provider:'bank'} as never,provider:'bank',operation:'money.payment.create',idempotencyKey:id,state:'RECOVERY_REQUIRED',startedAt:'2026-09-19T00:00:00Z',recoveryRequired:true,...over})
const rejects=async(parent:ExecutionAttempt,child:ExecutionAttempt,code:string,extra:ExecutionAttempt[]=[])=>
 assert.rejects(()=>assertRecoveryChildLineage(new Store(new Map([parent,...extra].map(x=>[x.attemptId,x]))),{parentExecutionId:parent.attemptId,child}),new RegExp(code))

test('accepts a valid recovery child',async()=>{const p=base('p');const c=base('c',{state:'STARTED',recoveryRequired:false,recoveryOfExecutionId:'p'});assert.equal((await assertRecoveryChildLineage(new Store(new Map([['p',p]])),{parentExecutionId:'p',child:c})).attemptId,'p')})
test('rejects forged parent',async()=>{const p=base('p');await rejects(p,base('c',{recoveryOfExecutionId:'other'}),'PARENT_LINEAGE_MISMATCH')})
test('rejects changed economic fingerprint',async()=>{const p=base('p');await rejects(p,base('c',{recoveryOfExecutionId:'p',actionFingerprint:'changed'}),'ACTION_FINGERPRINT_MISMATCH')})
test('rejects provider and operation drift',async()=>{const p=base('p');await rejects(p,base('c',{recoveryOfExecutionId:'p',provider:'other'}),'PROVIDER_MISMATCH');await rejects(p,base('c2',{recoveryOfExecutionId:'p',operation:'other'}),'OPERATION_MISMATCH')})
test('rejects missing ancestor',async()=>{const p=base('p',{recoveryOfExecutionId:'missing'});await rejects(p,base('c',{recoveryOfExecutionId:'p'}),'ANCESTOR_NOT_FOUND')})
test('rejects lineage cycle',async()=>{const p=base('p',{recoveryOfExecutionId:'a'});const a=base('a',{recoveryOfExecutionId:'p'});await rejects(p,base('c',{recoveryOfExecutionId:'p'}),'LINEAGE_CYCLE',[a])})
test('rejects generation overflow',async()=>{const root=base('root');const p1=base('p1',{recoveryOfExecutionId:'root'});const p2=base('p2',{recoveryOfExecutionId:'p1'});const p3=base('p3',{recoveryOfExecutionId:'p2'});await rejects(p3,base('c',{recoveryOfExecutionId:'p3'}),'GENERATION_LIMIT',[p2,p1,root])})
