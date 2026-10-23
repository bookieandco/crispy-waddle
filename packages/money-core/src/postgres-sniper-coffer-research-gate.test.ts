import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {issueExecutionPermit} from './execution-permit.js'
import {hashDexRuntime,type DexSwapIntent} from './solana-dex-runtime-contracts.js'
import {dexExecutionAction} from './dex-controlled-canary-runtime.js'
import {PostgresSniperCofferResearchGate} from './postgres-sniper-coffer-research-gate.js'
const now='2026-10-23T20:00:00Z'
const seed={
 executionId:'sniper-execution:1',tradeId:'sniper-trade:1',
 requestId:'sniper-request:1',runLineageId:'sniper-lineage:1',
 userId:'owner:1',strategyId:'sniper:canary',
 instrumentId:'solana:'+ '2'.repeat(32),leg:'ENTRY' as const,
 provider:'jupiter-ultra' as const,walletConnectionId:'coffer:isolated',
 signerLeaseId:'lease:1',inputMint:'2'.repeat(32),outputMint:'3'.repeat(32),
 inputAmountAtomic:1000n,minimumOutputAtomic:900n,
 notionalMinor:1000n,currency:'LAMPORTS',
 idempotencyKey:'research-sniper:1',informationCutoff:'2026-10-23T19:59:59Z',
}
const approval={
 sharkAssessmentId:'shark:risk:1',thesisId:'thesis:1',
 edgeDecisionBundleHash:'edge:hash',integrityGuardHash:'integrity:hash',
 moneyRiskDecisionId:'money:risk:1',
 intentFingerprint:hashDexRuntime({...seed,inputAmountAtomic:'1000',
  minimumOutputAtomic:'900',notionalMinor:'1000'}),
 approvedAt:'2026-10-23T19:59:59Z',
 authority:'MONEY_RISK_APPROVAL_BINDING' as const,
}
const intent:DexSwapIntent={...seed,
 approval:{...approval,bindingHash:hashDexRuntime(approval)},
 evidenceIds:['mint:chain:1','quote:jupiter:1'],
 authority:'MONEY_EXECUTION_INTENT',
}
const permit=issueExecutionPermit({
 action:dexExecutionAction(intent),actionRequestFingerprint:'action-request:trusted',
 authorityId:'operator:action-core',policyVersion:'canary:1',
 policyHash:'policy:money:1',expiresAt:'2026-10-23T20:01:00Z',now,
 permitId:'permit:research:1',nonce:'nonce:1',
})
const args={
 intent,permit,observedAt:now,expectedResearchPolicyHash:'owner-research:policy:v1',
 expectedCanaryVersion:3,
 context:{actionRequestFingerprint:'action-request:trusted',authorityId:'operator:action-core',
  policyVersion:'canary:1',policyHash:'policy:money:1'},
}
test('operator DB research admission is bound to canonical Money permit and parameterized',async()=>{
 let sql='',values:readonly unknown[]=[]
 const result=await new PostgresSniperCofferResearchGate({
  query:async<T>(s:string,v?:readonly unknown[])=>{
   sql=s;values=v??[]
   return {rows:[{admitted:true,reason:'RESEARCH_ONLY_NO_SIGN_AUTHORITY',
    research_hold_id:values[0]}] as T[]}
  },
 }).requestResearchHold(args)
 assert.equal(result.admitted,true)
 assert.equal(result.canSign,false)
 assert.equal(result.canSubmit,false)
 assert.equal(result.canCreditPurse,false)
 assert.match(sql,/public\.money_sniper_coffer_hold_research/)
 assert.doesNotMatch(sql,/\b(UPDATE|INSERT|DELETE)\b/i)
 assert.equal(values.length,12)
 assert.equal(values[3],intent.idempotencyKey)
 assert.equal(values[5],permit.permitId)
 assert.equal(values[6],permit.binding.actionFingerprint)
 assert.equal(values[8],'1000')
 assert.equal(values[10],3)
})
test('DB-rejected or duplicate requests never grant signing or conceal denial',async()=>{
 const result=await new PostgresSniperCofferResearchGate({
  query:async<T>()=>({rows:[{admitted:false,reason:'PREVIOUS_ORDER_UNRECONCILED',
   research_hold_id:null}] as T[]}),
 }).requestResearchHold(args)
 assert.equal(result.admitted,false)
 assert.deepEqual(result.reasonCodes,['PREVIOUS_ORDER_UNRECONCILED'])
 assert.equal(result.researchHoldId,undefined)
 assert.equal(result.canBroadcast,false)
})
test('forged success response or unavailable DB stops fail closed',async()=>{
 const fake={query:async<T>()=>({rows:[{admitted:true,
  reason:'RESEARCH_ONLY_NO_SIGN_AUTHORITY',research_hold_id:'forged:hold'}] as T[]})}
 await assert.rejects(new PostgresSniperCofferResearchGate(fake).requestResearchHold(args),
  /DB_BINDING_MISMATCH/)
 await assert.rejects(new PostgresSniperCofferResearchGate({
  query:async()=>{throw Error('DB offline')},
 }).requestResearchHold(args),/DB offline/)
})
test('invalid or wrong Action Core permit is rejected before hitting DB',async()=>{
 let called=0
 const db={query:async<T>()=>{called++;return {rows:[] as T[]}}}
 await assert.rejects(new PostgresSniperCofferResearchGate(db).requestResearchHold({
  ...args,context:{...args.context,authorityId:'untrusted:browser'},
 }),/authority mismatch/i)
 assert.equal(called,0)
 await assert.rejects(new PostgresSniperCofferResearchGate(db).requestResearchHold({
  ...args,expectedCanaryVersion:-1,
 }),/INPUT_INVALID/)
 assert.equal(called,0)
})
test('staged SQL is operator-only; no HTTP/anon, research defaults halted',async()=>{
 const sql=await readFile(new URL('../migrations/031_shark_sniper_coffer_research_gate.sql',import.meta.url),'utf8')
 assert.match(sql,/security invoker/i)
 assert.match(sql,/for update/i)
 assert.match(sql,/research_enabled boolean not null default false/i)
 assert.match(sql,/permanently_halted boolean not null default true/i)
 assert.match(sql,/live_signing_enabled = false/i)
 assert.match(sql,/from public, anon, authenticated, service_role/i)
 assert.doesNotMatch(sql,/grant execute/i)
 assert.match(sql,/RESEARCH_ONLY_NO_SIGN_AUTHORITY/)
})
