import {assertDexSwapIntent,type DexSwapIntent,type DexManagedOrder,
 type DexExecutionAttempt,type DexOnchainReceipt} from './solana-dex-runtime-contracts.js'
import type {DexRuntimeReadinessReport} from './dex-runtime-readiness.js'
import {assessSniperFastlane,type SniperFastlaneInput} from './sniper-opportunity-clock.js'
import {assertCanaryPolicy,type LiveCanaryPolicy,type LiveCanaryState} from './live-canary-contracts.js'
import {assertSignerLeaseMayPrepare,type SignerLease,type SignerLeasePolicy,
 type SignerRollingObservation} from './signer-lease-contracts.js'
import {evaluateSniperExit,type SniperPositionState,type SniperExitPolicy,
 type SniperExitQuote} from './sniper-exit-sentinel.js'

/** LIVE-GATE.25-.29 is a bounded pre-authorization REVIEW layer over the
 * existing canonical Money DEX canary runtime. No methods below obtain keys,
 * sign, submit, release permits, mutate risk ledgers or credit Purse.
 * The actual submitControlledDexCanaryLeg must remain a SEPARATE approved path.
 */
export type SniperLiveGatePolicy=Readonly<{
 policyId:string;maxOrderAgeMs:number;maxQuoteAgeMs:number
 maxSlippageBps:number;maxPriceImpactBps:number
 maxEstimatedFeesLamports:bigint;maxDailyLossMinor:bigint
 maxUnresolvedExits:number;minSolFeeReserveLamports:bigint
 authority:'SNIPER_LIVE_REVIEW_POLICY'
}>
export type SniperExecutableQuoteReview=Readonly<{
 quoteId:string;order:DexManagedOrder
 observedAt:string;expiresAt:string
 priceImpactBps:number;instructionReviewEvidenceIds:readonly string[];estimatedPriorityFeeLamports:bigint
 estimatedJitoTipLamports:bigint;estimatedBaseFeeLamports:bigint
 source:'JUPITER_ORDER_CANDIDATE'
 /** Strictly false until a separate transaction-instruction decoder
  * attests program/accounts, fee payer, signer and token authorities. */
 transactionInstructionsVerified:boolean
}>
export type SniperLiveEntryReview=Readonly<{
 version:'SHARK-SNIPER.LIVE-GATE.25-27'
 status:'REVIEW_READY'|'BLOCKED'
 reasonCodes:readonly string[]
 riskAndQuoteAgeMs?:number
 totalEstimatedFeeLamports?:bigint
 canSign:false;canSubmit:false;canTrade:false;canCreditPurse:false
 authority:'SNIPER_LIVE_READINESS_ONLY'
}>
export type SniperEntryReviewInput=Readonly<{
 intent:DexSwapIntent;quote?:SniperExecutableQuoteReview
 entryClock:SniperFastlaneInput
 confirmedMintSignature?:string;onchainMintAttested:boolean
 riskDisposition:'PAPER_CANDIDATE'|'BLOCK'|'REVIEW'
 riskEvidenceAvailableAt:string
 ownerWalletConnectionId:string;cofferWalletConnectionId:string;cofferWalletAddress:string
 signerPolicy:SignerLeasePolicy;signerLease:SignerLease
 signerObservation:SignerRollingObservation
 readiness:DexRuntimeReadinessReport
 canaryPolicy:LiveCanaryPolicy;canaryState?:LiveCanaryState
 solFeeReserveLamports:bigint
 hasUnresolvedEntry:boolean;unresolvedExitCount:number
 killSwitchActive:boolean
 policy:SniperLiveGatePolicy;now:string
}>
const ms=(v:string)=>{const n=Date.parse(v);return Number.isFinite(n)?n:NaN}
const validNonnegative=(n:number)=>Number.isSafeInteger(n)&&n>=0
const safeReason=(reasons:string[],code:string,condition:boolean)=>{if(condition)reasons.push(code)}
export function reviewSniperLiveEntry(input:SniperEntryReviewInput):SniperLiveEntryReview{
 const {policy:p,intent:i,quote:q}=input
 const reasons:string[]=[]
 if(!p.policyId.trim()||p.authority!=='SNIPER_LIVE_REVIEW_POLICY'||
  !validNonnegative(p.maxOrderAgeMs)||p.maxOrderAgeMs===0||
  !validNonnegative(p.maxQuoteAgeMs)||p.maxQuoteAgeMs===0||
  !validNonnegative(p.maxSlippageBps)||p.maxSlippageBps>10000||
  !validNonnegative(p.maxPriceImpactBps)||p.maxPriceImpactBps>10000||
  !validNonnegative(p.maxUnresolvedExits)||p.maxEstimatedFeesLamports<0n||
  p.maxDailyLossMinor<0n||p.minSolFeeReserveLamports<0n){
  throw Error('SNIPER_LIVE_POLICY_INVALID')
 }
 const now=ms(input.now)
 if(!Number.isFinite(now)||input.solFeeReserveLamports<0n||
    !validNonnegative(input.unresolvedExitCount)){
  throw Error('SNIPER_LIVE_OBSERVATION_INVALID')
 }
 try{assertDexSwapIntent(i)}catch{reasons.push('CANONICAL_MONEY_APPROVAL_REQUIRED')}
 safeReason(reasons,'ENTRY_INTENT_REQUIRED',i.leg!=='ENTRY')
 safeReason(reasons,'ORDER_INFORMATION_CUTOFF_STALE',
  !Number.isFinite(ms(i.informationCutoff))||ms(i.informationCutoff)>now||
  now-ms(i.informationCutoff)>p.maxOrderAgeMs)
 try{assertCanaryPolicy(input.canaryPolicy)}catch{reasons.push('MONEY_CANARY_POLICY_INVALID')}
 safeReason(reasons,'OWNER_COFFER_WALLET_NOT_ISOLATED',
  !input.ownerWalletConnectionId.trim()||i.walletConnectionId!==input.cofferWalletConnectionId||
  input.ownerWalletConnectionId===input.cofferWalletConnectionId||
  !input.cofferWalletAddress.trim()||
  input.signerPolicy.walletConnectionId!==input.cofferWalletConnectionId)
 safeReason(reasons,'RUNTIME_NOT_CERTIFIED',
  !input.readiness.ready||input.readiness.status!=='READY_FOR_CONTROLLED_CANARY'||
  input.readiness.authority!=='READINESS_ONLY'||input.readiness.blockerCodes.length>0)
 safeReason(reasons,'CHAIN_MINT_NOT_ATTESTED',!input.onchainMintAttested||
  !input.confirmedMintSignature?.trim())
 safeReason(reasons,'SHARK_RISK_NOT_ACCEPTED',input.riskDisposition!=='PAPER_CANDIDATE')
 const available=ms(input.riskEvidenceAvailableAt)
 safeReason(reasons,'SHARK_RISK_EXPIRED',!Number.isFinite(available)||available>now||
  now-available>p.maxOrderAgeMs)
 try{
  const urgency=assessSniperFastlane({
   ...input.entryClock,now:input.now,
   riskEvidenceAvailableAt:input.riskEvidenceAvailableAt,
  })
  if(urgency.disposition!=='ENTRY_WINDOW_OPEN')reasons.push('FASTLANE_ENTRY_CLOSED',...urgency.reasonCodes)
 }catch{reasons.push('FASTLANE_EVIDENCE_INVALID')}
 safeReason(reasons,'PREVIOUS_ENTRY_UNRECONCILED',input.hasUnresolvedEntry)
 safeReason(reasons,'PREVIOUS_EXIT_UNRECONCILED',
  input.unresolvedExitCount>p.maxUnresolvedExits||input.unresolvedExitCount>0)
 safeReason(reasons,'KILL_SWITCH_ACTIVE',input.killSwitchActive||input.canaryState?.halted===true)
 safeReason(reasons,'SOL_FEE_RESERVE_INSUFFICIENT',input.solFeeReserveLamports<p.minSolFeeReserveLamports)
 safeReason(reasons,'SIGNER_OBSERVATION_STALE',
   !Number.isFinite(ms(input.signerObservation.observedAt))||
   ms(input.signerObservation.observedAt)>now||
   now-ms(input.signerObservation.observedAt)>input.canaryPolicy.maxRiskMetricAgeSeconds*1000)
 safeReason(reasons,'SIGNER_OUTPUT_MINT_NOT_ALLOWED',
   !input.signerPolicy.allowedAssets.includes(i.outputMint))
 try{
  assertSignerLeaseMayPrepare({
   policy:input.signerPolicy,lease:input.signerLease,observation:input.signerObservation,
   intent:{amountMinor:i.notionalMinor,assetId:i.inputMint,
    destinationAddress:input.cofferWalletAddress,now:input.now},
  })
 }catch{reasons.push('SIGNER_LEASE_POLICY_NOT_SATISFIED')}
 const state=input.canaryState,cp=input.canaryPolicy
 if(!state||state.currency!==cp.currency||cp.currency!==i.currency||
  state.accountId!==i.walletConnectionId||state.provider!==i.provider){
  reasons.push('CANARY_ACCOUNT_STATE_MISSING')
 }else{
  if(state.halted)reasons.push('CANARY_HALTED')
  if(!state.riskMetricEvidenceIds.length||!Number.isFinite(ms(state.updatedAt))||
     ms(state.updatedAt)>now||now-ms(state.updatedAt)>cp.maxRiskMetricAgeSeconds*1000){
   reasons.push('CANARY_RISK_METRIC_STALE')
  }
  if(state.submittedNotionalMinor<0n||state.realizedLossMinor<0n||
     state.grossExposureMinor<0n||state.submittedOrders<0){
   reasons.push('CANARY_STATE_INVALID')
  }
  if(state.unresolvedExecutionIds.length)reasons.push('CANARY_UNKNOWN_ATTEMPT')
  if(state.submittedNotionalMinor+i.notionalMinor>cp.maxDailySubmittedNotionalMinor||
     i.notionalMinor>cp.maxOrderNotionalMinor||
     state.grossExposureMinor+i.notionalMinor>cp.maxGrossExposureMinor||
     state.submittedOrders+1>cp.maxDailyOrders)reasons.push('CANARY_EXPOSURE_OR_VOLUME_CAP')
  if(state.realizedLossMinor>=cp.maxDailyRealizedLossMinor||
     state.realizedLossMinor>=p.maxDailyLossMinor)reasons.push('CANARY_DAILY_LOSS_STOP')
 }
 let estimatedFees:bigint|undefined
 let quoteAge:number|undefined
 if(!q){
  reasons.push('SELECTED_JUPITER_ORDER_REQUIRED')
 }else{
  const order=q.order
  const quoteAt=ms(q.observedAt),expiry=ms(q.expiresAt)
  quoteAge=now-quoteAt
  if(!Number.isFinite(quoteAt)||!Number.isFinite(expiry)||quoteAge<0||
     quoteAge>p.maxQuoteAgeMs||expiry<=now){
   reasons.push('JUPITER_ORDER_STALE')
  }
  if(q.source!=='JUPITER_ORDER_CANDIDATE'||order.provider!=='jupiter-ultra'||
   order.authority!=='PROVIDER_QUOTE_ONLY'||order.canBroadcast!==false||
   !order.evidenceIds.length||!q.quoteId.trim()||q.quoteId!==order.requestId||
   order.inputMint!==i.inputMint||order.outputMint!==i.outputMint||
   order.inputAmountAtomic!==i.inputAmountAtomic||
   order.takerAddress!==input.cofferWalletAddress||
   !order.takerAddress.trim()){
   reasons.push('JUPITER_ORDER_BINDING_MISMATCH')
  }
  if(!q.transactionInstructionsVerified||!q.instructionReviewEvidenceIds.length)
   reasons.push('TRANSACTION_INSTRUCTION_ATTESTATION_REQUIRED')
  if(input.entryClock.selectedQuoteAvailableAt!==q.observedAt||
     input.entryClock.entryOrderExpiresAt!==q.expiresAt){
   reasons.push('FASTLANE_SELECTED_QUOTE_NOT_BOUND')
  }
  if(!validNonnegative(q.priceImpactBps)||q.priceImpactBps>p.maxPriceImpactBps){
   reasons.push('PRICE_IMPACT_LIMIT')
  }
  for(const v of [q.estimatedPriorityFeeLamports,q.estimatedJitoTipLamports,q.estimatedBaseFeeLamports]){
   if(v<0n)reasons.push('FEE_COMPONENT_INVALID')
  }
  estimatedFees=q.estimatedPriorityFeeLamports+q.estimatedJitoTipLamports+q.estimatedBaseFeeLamports
  if(estimatedFees>p.maxEstimatedFeesLamports||
    input.solFeeReserveLamports<estimatedFees+p.minSolFeeReserveLamports){
   reasons.push('FEE_CAP_OR_RESERVE_EXCEEDED')
  }
  if(order.quotedOutputAtomic<=0n||i.minimumOutputAtomic<=0n||
   i.minimumOutputAtomic>order.quotedOutputAtomic){
   reasons.push('JUPITER_MINIMUM_OUTPUT_INVALID')
  }else{
   const slippage=((order.quotedOutputAtomic-i.minimumOutputAtomic)*10000n)/order.quotedOutputAtomic
   if(slippage>BigInt(p.maxSlippageBps))reasons.push('SLIPPAGE_LIMIT')
  }
 }
 return Object.freeze({
  version:'SHARK-SNIPER.LIVE-GATE.25-27',
  status:reasons.length?'BLOCKED':'REVIEW_READY',
  reasonCodes:Object.freeze([...new Set(reasons)]),
  ...(quoteAge!==undefined?{riskAndQuoteAgeMs:quoteAge}:{}),
  ...(estimatedFees!==undefined?{totalEstimatedFeeLamports:estimatedFees}:{}),
  canSign:false,canSubmit:false,canTrade:false,canCreditPurse:false,
  authority:'SNIPER_LIVE_READINESS_ONLY',
 })
}

export type SniperSettlementReview=Readonly<{
 version:'SHARK-SNIPER.LIVE-GATE.28'
 state:'PENDING_RECONCILIATION'|'FAILED_OR_UNKNOWN'|'MATCHED_OBSERVATION'
 reasonCodes:readonly string[]
 signature?:string
 inputDebitAtomic?:bigint;outputCreditAtomic?:bigint
 canCreditPurse:false;canRetryOrder:false;canExecute:false
 authority:'SNIPER_SETTLEMENT_RESEARCH_ONLY'
}>
/** Review only, not a substitute for canonical reconcileDexCanaryLeg.
 * Even MATCHED_OBSERVATION never credits the Purse or frees the permit. */
export function reviewSniperOnchainSettlement(input:{
 intent:DexSwapIntent;attempt?:DexExecutionAttempt;onchain?:DexOnchainReceipt
}):SniperSettlementReview{
 const reasons:string[]=[]
 const a=input.attempt,o=input.onchain,i=input.intent
 try{assertDexSwapIntent(i)}catch{reasons.push('INVALID_CANONICAL_INTENT')}
 if(!a||a.executionId!==i.executionId||a.walletConnectionId!==i.walletConnectionId||
   a.idempotencyKey!==i.idempotencyKey||a.inputMint!==i.inputMint||
   a.outputMint!==i.outputMint||a.inputAmountAtomic!==i.inputAmountAtomic||
   a.leg!==i.leg||a.signerLeaseId!==i.signerLeaseId||
   a.runLineageId!==i.runLineageId||
   a.authority!=='EXECUTION_ATTEMPT_ONLY'){
  reasons.push('ATTEMPT_NOT_RECONCILED_TO_INTENT')
 }
 if(!o||!o.found||!o.confirmed||o.failed||
   o.authority!=='ONCHAIN_EVIDENCE'||!o.evidenceIds.length){
  reasons.push('ONCHAIN_SETTLEMENT_NOT_CONFIRMED')
 }
 if(a&&o&&o.signature!==a.primarySignature)reasons.push('SIGNATURE_MISMATCH')
 if(o?.inputDebitAtomic!==i.inputAmountAtomic||o?.outputCreditAtomic===undefined||
   o.outputCreditAtomic<i.minimumOutputAtomic)reasons.push('ONCHAIN_DEBIT_OR_MINIMUM_OUTPUT_MISMATCH')
 if(a?.simulatedFeeLamports===undefined||o?.feeLamports!==a.simulatedFeeLamports)
  reasons.push('FEE_NOT_RECONCILED')
 if(a&&a.state!=='RECONCILED')reasons.push('CANONICAL_RUNTIME_RECONCILIATION_REQUIRED')
 if(o?.feeLamports!==undefined&&o.feeLamports<0n)reasons.push('NEGATIVE_ONCHAIN_FEE')
 const state:SniperSettlementReview['state']=!a||!o||!o.found||!o.confirmed?
  'PENDING_RECONCILIATION':reasons.length?'FAILED_OR_UNKNOWN':'MATCHED_OBSERVATION'
 return Object.freeze({
  version:'SHARK-SNIPER.LIVE-GATE.28',state,
  reasonCodes:Object.freeze([...new Set(reasons)]),
  ...(o?.signature?{signature:o.signature}:{}),
  ...(o?.inputDebitAtomic!==undefined?{inputDebitAtomic:o.inputDebitAtomic}:{}),
  ...(o?.outputCreditAtomic!==undefined?{outputCreditAtomic:o.outputCreditAtomic}:{}),
  canCreditPurse:false,canRetryOrder:false,canExecute:false,
  authority:'SNIPER_SETTLEMENT_RESEARCH_ONLY',
 })
}

export type SniperExitReview=Readonly<{
 version:'SHARK-SNIPER.LIVE-GATE.29'
 status:'RECONCILE_FIRST'|'NO_SELL_ROUTE'|'NO_EXIT_SIGNAL'|'EXIT_REVIEW_CANDIDATE'
 reasonCodes:readonly string[]
 canSign:false;canSubmit:false;canExecute:false
 authority:'EXIT_REVIEW_ONLY'
}>
/** Exit proposals use Money's exit sentinel. Unknown live submissions are
 * reconciled before any second sell; missing reverse quotes never become fills. */
export function reviewSniperCofferExit(input:{
 position:SniperPositionState;quote?:SniperExitQuote;policy:SniperExitPolicy
 now:string;entryReconciled:boolean;hasUnknownExitAttempt:boolean
 killSwitchActive:boolean
}):SniperExitReview{
 const decision=evaluateSniperExit({
  position:input.position,quote:input.quote,policy:input.policy,
  unresolvedPreviousExit:input.hasUnknownExitAttempt,now:input.now,
 })
 const reasons=[...decision.reasonCodes]
 if(!input.entryReconciled)reasons.push('ENTRY_SETTLEMENT_RECONCILIATION_REQUIRED')
 if(input.killSwitchActive)reasons.push('KILL_SWITCH_ACTIVE')
 const status:SniperExitReview['status']=input.hasUnknownExitAttempt||!input.entryReconciled?
  'RECONCILE_FIRST':decision.action==='EXIT_ROUTE_MISSING'?'NO_SELL_ROUTE':
  decision.action==='EXIT_PAPER_CANDIDATE'&&!input.killSwitchActive?
    'EXIT_REVIEW_CANDIDATE':'NO_EXIT_SIGNAL'
 return Object.freeze({
  version:'SHARK-SNIPER.LIVE-GATE.29',status,
  reasonCodes:Object.freeze([...new Set(reasons)]),
  canSign:false,canSubmit:false,canExecute:false,authority:'EXIT_REVIEW_ONLY',
 })
}
