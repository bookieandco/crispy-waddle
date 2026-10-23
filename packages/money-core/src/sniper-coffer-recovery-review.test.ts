import test from 'node:test'
import assert from 'node:assert/strict'
import {hashDexRuntime,type DexSwapIntent,type DexExecutionAttempt,
 type DexOnchainReceipt} from './solana-dex-runtime-contracts.js'
import {reviewSniperCofferRecovery} from './sniper-coffer-recovery-review.js'
const now='2026-10-23T19:00:00Z'
const original={
 executionId:'exec:coffer:recovery',tradeId:'trade:coffer',
 requestId:'request:coffer',runLineageId:'lineage:coffer',
 userId:'owner',strategyId:'sniper:coffer',instrumentId:'solana:coffer',
 leg:'ENTRY' as const,provider:'jupiter-ultra' as const,
 walletConnectionId:'coffer:wallet',signerLeaseId:'lease:1',
 inputMint:'2'.repeat(32),outputMint:'3'.repeat(32),
 inputAmountAtomic:1000n,minimumOutputAtomic:900n,notionalMinor:1000n,
 currency:'LAMPORTS',idempotencyKey:'idempotency:coffer:recovery',
 informationCutoff:'2026-10-23T18:59:59Z',
}
const binding={
 sharkAssessmentId:'risk:1',thesisId:'thesis:1',edgeDecisionBundleHash:'edge:1',
 integrityGuardHash:'integrity:1',moneyRiskDecisionId:'risk:money:1',
 intentFingerprint:hashDexRuntime({...original,inputAmountAtomic:'1000',
  minimumOutputAtomic:'900',notionalMinor:'1000'}),
 approvedAt:'2026-10-23T18:59:59Z',authority:'MONEY_RISK_APPROVAL_BINDING' as const,
}
const intent:DexSwapIntent={...original,approval:{...binding,bindingHash:hashDexRuntime(binding)},
 evidenceIds:['chain:proof'],authority:'MONEY_EXECUTION_INTENT'}
const attempt:DexExecutionAttempt={
 attemptId:'attempt:1',executionId:intent.executionId,requestId:intent.requestId,
 runLineageId:intent.runLineageId,leg:'ENTRY',provider:'jupiter-ultra',
 walletConnectionId:intent.walletConnectionId,signerLeaseId:intent.signerLeaseId,
 idempotencyKey:intent.idempotencyKey,
 inputMint:intent.inputMint,outputMint:intent.outputMint,
 inputAmountAtomic:intent.inputAmountAtomic,minimumOutputAtomic:intent.minimumOutputAtomic,
 signedTransactionHash:'tx:hash',primarySignature:'signature:chain:1',
 providerRequestId:'jupiter:request:1',simulatedFeeLamports:5000n,
 state:'UNKNOWN',startedAt:now,updatedAt:now,evidenceIds:['attempt:evidence'],
 authority:'EXECUTION_ATTEMPT_ONLY',
}
const onchain:DexOnchainReceipt={
 signature:attempt.primarySignature,found:true,confirmed:true,failed:false,
 slot:54321,feeLamports:5000n,inputDebitAtomic:intent.inputAmountAtomic,
 outputCreditAtomic:950n,observedAt:now,evidenceIds:['independent:rpc'],
 authority:'ONCHAIN_EVIDENCE',
}
function host(a:DexExecutionAttempt|undefined=attempt,o:DexOnchainReceipt=onchain){
 return {
  intent,cofferAddress:'4'.repeat(32),now,
  attemptStore:{getByIdempotencyKey:async()=>a},
  chain:{observeSwap:async()=>o},
 }
}
test('unknown potentially landed order is NEVER auto-retried',async()=>{
 const pending=await reviewSniperCofferRecovery(host(attempt,{...onchain,found:false,confirmed:false}))
 assert.equal(pending.status,'AWAIT_CHAIN')
 assert.equal(pending.canRetry,false)
 assert.equal(pending.canSign,false)
 assert.equal(pending.canCreditPurse,false)
 const seen=await reviewSniperCofferRecovery(host())
 assert.equal(seen.status,'CANONICAL_RECONCILE_REQUIRED')
 assert.equal(seen.canRetry,false)
})
test('only canonical RECONCILED attempt plus chain matching is an observation',async()=>{
 const r=await reviewSniperCofferRecovery(host({...attempt,state:'RECONCILED'}))
 assert.equal(r.status,'OBSERVED_RECONCILED',r.reasonCodes.join(','))
 assert.equal(r.canCreditPurse,false)
 assert.equal(r.canSubmit,false)
})
test('RPC timeout, missing attempts or failed settlement cannot be considered a safe replacement',async()=>{
 const missing=await reviewSniperCofferRecovery({...host(),attemptStore:{getByIdempotencyKey:async()=>undefined}})
 assert.equal(missing.status,'NO_KNOWN_ATTEMPT')
 assert.equal(missing.canRetry,false)
 const p=host()
 const failed=await reviewSniperCofferRecovery({...p,chain:{
  observeSwap:async()=>{throw Error('RPC timeout')},
 }})
 assert.equal(failed.status,'CHAIN_UNAVAILABLE')
 assert.equal(failed.canRetry,false)
 const chainFailed=await reviewSniperCofferRecovery(host({...attempt,state:'FAILED'},
  {...onchain,failed:true}))
 assert.equal(chainFailed.status,'SETTLEMENT_DISPUTED')
 const swap=await reviewSniperCofferRecovery(host({...attempt,state:'RECONCILED'},
  {...onchain,outputCreditAtomic:20n}))
 assert.equal(swap.status,'SETTLEMENT_DISPUTED')
})
test('wrong original intent identity and signature mismatch never reclassify a trade',async()=>{
 const mismatched=await reviewSniperCofferRecovery(host({...attempt,inputMint:'8'.repeat(32)}))
 assert.equal(mismatched.status,'SETTLEMENT_DISPUTED')
 const chain=await reviewSniperCofferRecovery(host({...attempt,state:'RECONCILED'},
  {...onchain,signature:'different:signature'}))
 assert.equal(chain.status,'SETTLEMENT_DISPUTED')
})
