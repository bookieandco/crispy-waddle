import {assertDexSwapIntent,type DexSwapIntent,
 type DexExecutionAttemptStore,type SolanaChainObserver} from './solana-dex-runtime-contracts.js'
import {reviewSniperOnchainSettlement} from './sniper-live-canary-gate.js'

/** COFFER-ACCEPT.44 — one read-only iteration of canonical signer recovery.
 * A timeout/UNKNOWN cannot authorize an automatic replacement transaction.
 * Canonical reconcileDexCanaryLeg must independently update the attempt
 * store after confirmation; this module changes nothing.
 */
export type SniperCofferRecoveryReview=Readonly<{
 version:'SHARK-SNIPER.COFFER-ACCEPT.44'
 status:'NO_KNOWN_ATTEMPT'|'AWAIT_CHAIN'|'CHAIN_UNAVAILABLE'|
  'CANONICAL_RECONCILE_REQUIRED'|'SETTLEMENT_DISPUTED'|'OBSERVED_RECONCILED'
 reasonCodes:readonly string[]
 executionId:string;idempotencyKey:string
 signature?:string;slot?:number
 canRetry:false;canSign:false;canSubmit:false;canCreditPurse:false
 authority:'RECOVERY_REVIEW_ONLY'
}>
const report=(i:DexSwapIntent,status:SniperCofferRecoveryReview['status'],
 reasons:readonly string[],signature?:string,slot?:number):SniperCofferRecoveryReview=>Object.freeze({
 version:'SHARK-SNIPER.COFFER-ACCEPT.44',status,
 reasonCodes:Object.freeze([...new Set(reasons)]),
 executionId:i.executionId,idempotencyKey:i.idempotencyKey,
 ...(signature?{signature}:{}),
 ...(slot!==undefined?{slot}:{}),
 canRetry:false,canSign:false,canSubmit:false,canCreditPurse:false,
 authority:'RECOVERY_REVIEW_ONLY',
})
export async function reviewSniperCofferRecovery(input:{
 intent:DexSwapIntent;cofferAddress:string;now:string
 attemptStore:Pick<DexExecutionAttemptStore,'getByIdempotencyKey'>
 chain:Pick<SolanaChainObserver,'observeSwap'>
}):Promise<SniperCofferRecoveryReview>{
 const {intent:i}=input
 try{assertDexSwapIntent(i)}catch{throw Error('SNIPER_RECOVERY_INTENT_INVALID')}
 if(!input.cofferAddress.trim()||!Number.isFinite(Date.parse(input.now)))
  throw Error('SNIPER_RECOVERY_INPUT_INVALID')
 let attempt
 try{attempt=await input.attemptStore.getByIdempotencyKey(i.idempotencyKey)}
 catch{return report(i,'CHAIN_UNAVAILABLE',['ATTEMPT_STORE_UNAVAILABLE'])}
 if(!attempt)return report(i,'NO_KNOWN_ATTEMPT',['NO_ATTEMPT_PROOF_CANNOT_INFER_NEVER_SIGNED'])
 if(attempt.executionId!==i.executionId||
    attempt.walletConnectionId!==i.walletConnectionId||
    attempt.inputMint!==i.inputMint||attempt.outputMint!==i.outputMint||
    attempt.inputAmountAtomic!==i.inputAmountAtomic||
    attempt.signerLeaseId!==i.signerLeaseId||
    !attempt.primarySignature.trim())
  return report(i,'SETTLEMENT_DISPUTED',['ATTEMPT_LINEAGE_OR_SIGNATURE_MISMATCH'])
 let observed
 try{
  observed=await input.chain.observeSwap({
   signature:attempt.primarySignature,walletAddress:input.cofferAddress,
   inputMint:i.inputMint,outputMint:i.outputMint,now:input.now,
  })
 }catch{return report(i,'CHAIN_UNAVAILABLE',
  ['CHAIN_RPC_UNAVAILABLE_KEEP_ORDER_FROZEN'],attempt.primarySignature)}
 if(!observed.found||!observed.confirmed)
  return report(i,'AWAIT_CHAIN',
   ['POSSIBLY_LANDED_DO_NOT_RETRY'],attempt.primarySignature,observed.slot)
 const review=reviewSniperOnchainSettlement({
  intent:i,attempt,onchain:observed,
 })
 if(observed.failed||review.reasonCodes.some(code=>code!=='CANONICAL_RUNTIME_RECONCILIATION_REQUIRED'))
  return report(i,'SETTLEMENT_DISPUTED',
   [...review.reasonCodes,'MANUAL_RECONCILIATION_REQUIRED'],attempt.primarySignature,observed.slot)
 if(attempt.state!=='RECONCILED')
  return report(i,'CANONICAL_RECONCILE_REQUIRED',
   ['CHAIN_OBSERVED_CANONICAL_ATTEMPT_NOT_SETTLED'],attempt.primarySignature,observed.slot)
 if(review.state!=='MATCHED_OBSERVATION')
  return report(i,'SETTLEMENT_DISPUTED',
   ['CANONICAL_REVIEW_NOT_MATCHED'],attempt.primarySignature,observed.slot)
 return report(i,'OBSERVED_RECONCILED',[],attempt.primarySignature,observed.slot)
}
