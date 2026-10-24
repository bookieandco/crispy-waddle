import test from 'node:test'
import assert from 'node:assert/strict'
import {hashDexRuntime,type DexSwapIntent,type DexManagedOrder} from './solana-dex-runtime-contracts.js'
import {issueExecutionPermit} from './execution-permit.js'
import {dexExecutionAction} from './dex-controlled-canary-runtime.js'
import {sha256UnsignedTransaction} from './sniper-transaction-byte-audit.js'
import {PostgresSniperPreSignGate,type SniperPreSignState} from './sniper-signer-presign-gate.js'
import type {SniperSignerReview} from './sniper-signer-certification.js'
const now='2026-10-24T16:00:00Z'
const data=Buffer.alloc(200,5).toString('base64')
const original={
 executionId:'exec:sign:1',tradeId:'trade:sign:1',requestId:'request:sign:1',
 runLineageId:'lineage:sign:1',userId:'owner:1',strategyId:'sniper:test',
 instrumentId:'solana:mint',leg:'ENTRY' as const,provider:'jupiter-ultra' as const,
 walletConnectionId:'coffer:isolated',signerLeaseId:'lease:1',
 inputMint:'2'.repeat(32),outputMint:'3'.repeat(32),
 inputAmountAtomic:1000n,minimumOutputAtomic:900n,notionalMinor:1000n,
 currency:'LAMPORTS',idempotencyKey:'idempotency:signer:1',
 informationCutoff:'2026-10-24T15:59:59Z',
}
const binding={
 sharkAssessmentId:'shark:1',thesisId:'thesis:1',
 edgeDecisionBundleHash:'edge:1',integrityGuardHash:'integrity:1',
 moneyRiskDecisionId:'money:approved',
 intentFingerprint:hashDexRuntime({...original,inputAmountAtomic:'1000',
  minimumOutputAtomic:'900',notionalMinor:'1000'}),
 approvedAt:'2026-10-24T15:59:59Z',
 authority:'MONEY_RISK_APPROVAL_BINDING' as const,
}
const intent:DexSwapIntent={...original,
 approval:{...binding,bindingHash:hashDexRuntime(binding)},
 evidenceIds:['risk:1'],authority:'MONEY_EXECUTION_INTENT',
}
const order:DexManagedOrder={
 provider:'jupiter-ultra',requestId:'jupiter:1',
 inputMint:intent.inputMint,outputMint:intent.outputMint,
 inputAmountAtomic:intent.inputAmountAtomic,quotedOutputAtomic:950n,
 unsignedTransactionBase64:data,takerAddress:'4'.repeat(44),
 evidenceIds:['provider:1'],authority:'PROVIDER_QUOTE_ONLY',canBroadcast:false,
}
const review:SniperSignerReview={
 version:'SHARK-SNIPER.SIGNER-CERTIFY.36-40',
 disposition:'RESEARCH_OBSERVATION_MATCHED',
 reasonCodes:[],transactionSha256:sha256UnsignedTransaction(data),
 lookupTables:[],canSign:false,canSubmit:false,canRetry:false,canCreditPurse:false,
 authority:'SIGNER_RESEARCH_ONLY',
}
const permit=issueExecutionPermit({
 action:dexExecutionAction(intent),actionRequestFingerprint:'action-request:trusted',
 authorityId:'action-core:owner',policyVersion:'risk:1',policyHash:'policy:money',
 now,expiresAt:'2026-10-24T16:01:00Z',permitId:'permit:1',nonce:'nonce:1',
})
const context={
 actionRequestFingerprint:'action-request:trusted',authorityId:'action-core:owner',
 policyVersion:'risk:1',policyHash:'policy:money',
}
const candidate={intent,order,signerReview:review,
 researchHoldId:'sniper-research:1',permit,permitContext:context,at:now}
test('durable staged PRE-SIGN returns proof-only; never signs or consumes permit',async()=>{
 let sql='',params:readonly unknown[]=[]
 const gate=new PostgresSniperPreSignGate({
  query:async<T>(query:string,args?:readonly unknown[])=>{
   sql=query;params=args??[]
   return {rows:[{admitted:true,reason:'UNSIGNED_HOLD_ONLY',
    presign_id:params[0]}] as T[]}
  },
 })
 const result=await gate.stage(candidate)
 assert.equal(result.admitted,true)
 assert.equal(result.canSign,false)
 assert.equal(result.canTrade,false)
 assert.equal(result.canRetry,false)
 assert.equal(result.moneyPermitNotConsumed,true)
 assert.equal(result.signerNeverInvoked,true)
 assert.match(sql,/money_sniper_signer_stage_presign/)
 assert.doesNotMatch(sql,/\b(UPDATE|DELETE|INSERT)\b/i)
 assert.equal(params.length,10)
 assert.equal(params[6],permit.permitId)
 assert.equal(params[7],intent.signerLeaseId)
 assert.equal(params[8],hashDexRuntime(intent))
 assert.equal(params[9],sha256UnsignedTransaction(data))
})
test('wrong permit provenance or substituted exact transaction rejected before DB call',async()=>{
 let called=0
 const gate=new PostgresSniperPreSignGate({
  query:async<T>()=>{called++;return {rows:[] as T[]}},
 })
 await assert.rejects(gate.stage({...candidate,
  permitContext:{...context,authorityId:'malicious:browser'}}),/authority mismatch/i)
 await assert.rejects(gate.stage({...candidate,
  signerReview:{...review,transactionSha256:'a'.repeat(64)}}),
 /MESSAGE_HASH_MISMATCH/)
 await assert.rejects(gate.stage({...candidate,
  signerReview:{...review,disposition:'BLOCKED'}}),
 /CANDIDATE_NOT_CERTIFIED/)
 assert.equal(called,0)
})
test('forged DB success, database outage and replay rejection never yield sign authority',async()=>{
 const fake=new PostgresSniperPreSignGate({
  query:async<T>()=>({rows:[{admitted:true,reason:'UNSIGNED_HOLD_ONLY',
   presign_id:'wrong:sha'}] as T[]}),
 })
 await assert.rejects(fake.stage(candidate),/DB_RESULT_NOT_BOUND/)
 const blocked=new PostgresSniperPreSignGate({
  query:async<T>()=>({rows:[{admitted:false,
   reason:'PREVIOUS_SIGNER_ATTEMPT_UNRESOLVED',presign_id:null}] as T[]}),
 })
 const result=await blocked.stage(candidate)
 assert.equal(result.admitted,false)
 assert.deepEqual(result.reasonCodes,['PREVIOUS_SIGNER_ATTEMPT_UNRESOLVED'])
 assert.equal(result.canBroadcast,false)
 await assert.rejects(new PostgresSniperPreSignGate({
  query:async()=>{throw Error('postgres-offline')},
 }).stage(candidate),/postgres-offline/)
})
test('recovery unknown, missing, and revocation cannot authorize retry',async()=>{
 for(const [state,expected] of [
  ['PRESIGN_HELD','UNSIGNED_HOLD'],
  ['SIGNING_UNKNOWN','UNKNOWN_FREEZE_AND_RECONCILE'],
  ['SETTLEMENT_UNKNOWN','UNKNOWN_FREEZE_AND_RECONCILE'],
  ['RECONCILED_OBSERVED','OBSERVED_ONLY'],
  ['REVOKED_HOLD','REVOKED_NO_RETRY'],
 ] as const){
  const gate=new PostgresSniperPreSignGate({query:async<T>()=>({
   rows:[{state:state as SniperPreSignState,
    unsigned_transaction_hash:'a'.repeat(64),
    wallet_connection_id:intent.walletConnectionId,
    idempotency_key:intent.idempotencyKey,
    permit_id:permit.permitId,signer_lease_id:intent.signerLeaseId}] as T[],
  })})
  const r=await gate.inspect({presignId:'sniper-presign:1',
   walletConnectionId:intent.walletConnectionId,idempotencyKey:intent.idempotencyKey})
  assert.equal(r.status,expected)
  assert.equal(r.canRetry,false)
  assert.equal(r.canSign,false)
 }
 const absent=new PostgresSniperPreSignGate({query:async<T>()=>({rows:[] as T[]})})
 const missing=await absent.inspect({presignId:'sniper-presign:missing',
  walletConnectionId:intent.walletConnectionId,idempotencyKey:intent.idempotencyKey})
 assert.equal(missing.status,'NO_RECORD_MANUAL_CHECK')
 assert.equal(missing.canRetry,false)
})
