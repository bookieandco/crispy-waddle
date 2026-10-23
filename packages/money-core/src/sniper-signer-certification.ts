import type {DexSwapIntent,DexManagedOrder} from './solana-dex-runtime-contracts.js'
import type {LiveCanaryPolicy,LiveCanaryState} from './live-canary-contracts.js'
import type {SignerLease,SignerLeasePolicy,SignerRollingObservation} from './signer-lease-contracts.js'
import {assertSignerLeaseMayPrepare} from './signer-lease-contracts.js'
import {assertDexSwapIntent} from './solana-dex-runtime-contracts.js'
import {sha256UnsignedTransaction} from './sniper-transaction-byte-audit.js'
import {decodeSignerMessage,type SniperSignerRpcLookup,type DecodedSniperSignerMessage} from './sniper-signer-message.js'

/** SIGNER-CERTIFY.36–.40: an owner-host research verifier, NOT a Coffer signer.
 * The trusted adapter MUST be constructed by an isolated operator runtime;
 * NEVER pass browser-defined RPC or simulation responses into a signer.
 */
export type SniperSignerGuard=Readonly<{
 version:number;observedAt:string;halted:boolean
 unresolvedExecutionIds:readonly string[]
 existingIdempotencyKeys:readonly string[]
 canary:LiveCanaryState;signer:SignerRollingObservation
 solFeeReserveLamports:bigint;authority:'TRUSTED_GUARD_READ'
}>
export type SniperSimulatedTokenAccount=Readonly<{
 address:string;mint:string;owner:string
 beforeAtomic:bigint;afterAtomic:bigint
}>
export type SniperSignerSimulation=Readonly<{
 transactionSha256:string;contextSlot:number
 blockhash:string;err:string|null
 tokenAccounts:readonly SniperSimulatedTokenAccount[]
 executedProgramIds:readonly string[];allInnerInstructionsObserved:boolean
 baseFeeLamports:bigint;priorityFeeLamports:bigint
 jitoTipLamports:bigint;extraSolDebitLamports:bigint
 evidenceIds:readonly string[]
 authority:'TRUSTED_UNSIGNED_SIMULATION'
}>
export type SniperSignerTrustedHost=SniperSignerRpcLookup & Readonly<{
 now:()=>string
 readGuard:()=>Promise<SniperSignerGuard>
 /** Must perform read-only independent RPC simulation over original message
  * at the chosen slot, including ALL inner programs and token deltas. */
 simulateUnsigned:(input:{
  transactionBase64:string;sha256:string
  minContextSlot:number;watchedAccounts:readonly string[]
 })=>Promise<SniperSignerSimulation>
}>
export type SniperSignerSemanticPolicy=Readonly<{
 ownerWalletAddress:string;cofferAddress:string
 inputTokenAccount:string;outputTokenAccount:string
 allowedPrograms:readonly string[]
 minContextSlot:number;maxEvidenceAgeMs:number
 maxFeeLamports:bigint;minSolReserveLamports:bigint
 authority:'SIGNER_SEMANTIC_REVIEW_POLICY'
}>
export type SniperSignerReview=Readonly<{
 version:'SHARK-SNIPER.SIGNER-CERTIFY.36-40'
 disposition:'RESEARCH_OBSERVATION_MATCHED'|'BLOCKED'
 reasonCodes:readonly string[]
 transactionSha256?:string;lookupTables:readonly string[]
 simulatedOutputAtomic?:bigint;simulatedFeesLamports?:bigint
 guardVersion?:number
 canSign:false;canSubmit:false;canRetry:false;canCreditPurse:false
 authority:'SIGNER_RESEARCH_ONLY'
}>
const timestamp=(x:string):number=>Date.parse(x)
const fresh=(now:number,x:string,max:number)=>Number.isFinite(timestamp(x))&&
 timestamp(x)<=now&&now-timestamp(x)<=max
const allow=(valid:boolean,reasons:string[],code:string)=>{if(!valid)reasons.push(code)}
export async function certifySniperSignerCandidate(input:{
 intent:DexSwapIntent;order:DexManagedOrder
 signerLease:SignerLease;signerPolicy:SignerLeasePolicy
 canaryPolicy:LiveCanaryPolicy;policy:SniperSignerSemanticPolicy
 host:SniperSignerTrustedHost
}):Promise<SniperSignerReview>{
 const reasons:string[]=[],p=input.policy,i=input.intent,o=input.order
 let decoded:DecodedSniperSignerMessage|undefined
 let simulation:SniperSignerSimulation|undefined
 let start:SniperSignerGuard|undefined
 const firstNow=timestamp(input.host.now())
 if(!Number.isFinite(firstNow)||p.authority!=='SIGNER_SEMANTIC_REVIEW_POLICY'||
    !Number.isSafeInteger(p.minContextSlot)||p.minContextSlot<1||
    !Number.isSafeInteger(p.maxEvidenceAgeMs)||p.maxEvidenceAgeMs<1||
    p.maxFeeLamports<0n||p.minSolReserveLamports<0n||
    !p.cofferAddress||p.cofferAddress===p.ownerWalletAddress||
    !p.allowedPrograms.length||p.allowedPrograms.length>32){
  throw Error('SNIPER_SIGNER_CERTIFY_POLICY_INVALID')
 }
 try{assertDexSwapIntent(i)}catch{reasons.push('MONEY_INTENT_INVALID')}
 allow(o.provider==='jupiter-ultra'&&o.authority==='PROVIDER_QUOTE_ONLY'&&
   !o.canBroadcast&&o.requestId.trim().length>0&&o.evidenceIds.length>0&&
   o.inputMint===i.inputMint&&o.outputMint===i.outputMint&&
   o.inputAmountAtomic===i.inputAmountAtomic&&
   o.quotedOutputAtomic>=i.minimumOutputAtomic&&
   i.walletConnectionId===input.signerPolicy.walletConnectionId&&
   input.signerLease.leaseId===i.signerLeaseId&&
   o.takerAddress===p.cofferAddress&&p.cofferAddress!==p.ownerWalletAddress,
  reasons,'ORDER_OR_ISOLATED_COFFER_MISMATCH')
 allow(i.leg==='ENTRY',reasons,'ENTRY_ONLY_REVIEW')
 try{
  decoded=await decodeSignerMessage({
   unsignedTransactionBase64:o.unsignedTransactionBase64,
   expectedFeePayer:p.cofferAddress,minContextSlot:p.minContextSlot,rpc:input.host,
  })
  allow(decoded.sha256===sha256UnsignedTransaction(o.unsignedTransactionBase64),
   reasons,'ORIGINAL_TRANSACTION_HASH_CHANGED')
  allow(decoded.programIds.every(id=>p.allowedPrograms.includes(id)),
   reasons,'STATIC_PROGRAM_NOT_ALLOWED')
  allow(decoded.writableAccounts.includes(p.inputTokenAccount)&&
   decoded.writableAccounts.includes(p.outputTokenAccount),
   reasons,'TOKEN_ACCOUNT_NOT_WRITABLE_OR_ABSENT')
 }catch(e){reasons.push(e instanceof Error?e.message:'SIGNER_WIRE_UNAVAILABLE')}
 try{start=await input.host.readGuard()}catch{reasons.push('GUARD_STATE_UNAVAILABLE')}
 if(start){
  const c=start.canary
  allow(start.authority==='TRUSTED_GUARD_READ'&&
   Number.isSafeInteger(start.version)&&start.version>=0&&
   fresh(firstNow,start.observedAt,p.maxEvidenceAgeMs),
   reasons,'GUARD_EVIDENCE_INVALID')
  allow(!start.halted&&!c.halted,reasons,'KILL_SWITCH_ACTIVE')
  allow(start.unresolvedExecutionIds.length===0&&c.unresolvedExecutionIds.length===0,
   reasons,'UNRESOLVED_ORDER_OR_EXIT')
  allow(!start.existingIdempotencyKeys.includes(i.idempotencyKey),
   reasons,'DUPLICATE_ORDER_BLOCKED')
  allow(c.accountId===i.walletConnectionId&&c.provider===i.provider&&
    c.currency===i.currency&&fresh(firstNow,c.updatedAt,p.maxEvidenceAgeMs),
   reasons,'COFFER_RISK_STATE_INVALID')
  allow(start.solFeeReserveLamports>=p.minSolReserveLamports,
   reasons,'SOL_FEE_RESERVE_INSUFFICIENT')
  allow(c.realizedLossMinor>=0n&&
    c.realizedLossMinor<input.canaryPolicy.maxDailyRealizedLossMinor&&
    c.grossExposureMinor+i.notionalMinor<=input.canaryPolicy.maxGrossExposureMinor&&
    c.submittedNotionalMinor+i.notionalMinor<=input.canaryPolicy.maxDailySubmittedNotionalMinor&&
    i.notionalMinor<=input.canaryPolicy.maxOrderNotionalMinor&&
    c.submittedOrders+1<=input.canaryPolicy.maxDailyOrders,
   reasons,'CANARY_EXPOSURE_OR_DAILY_LOSS_STOP')
  allow(fresh(firstNow,start.signer.observedAt,p.maxEvidenceAgeMs),
   reasons,'SIGNER_OBSERVATION_STALE')
  try{
   assertSignerLeaseMayPrepare({
    policy:input.signerPolicy,lease:input.signerLease,observation:start.signer,
    intent:{amountMinor:i.notionalMinor,assetId:i.inputMint,
     destinationAddress:p.cofferAddress,now:new Date(firstNow).toISOString()},
   })
   if(!input.signerPolicy.allowedAssets.includes(i.outputMint))throw Error()
  }catch{reasons.push('SIGNER_POLICY_OR_LEASE_BLOCKED')}
 }
 // Fail before simulation if any source/guard/decoder problem. Unknown
 // outcomes never trigger retries; they require canonical reconciliation.
 if(decoded&&start&&reasons.length===0){
  try{
   simulation=await input.host.simulateUnsigned({
    transactionBase64:o.unsignedTransactionBase64,sha256:decoded.sha256,
    minContextSlot:p.minContextSlot,
    watchedAccounts:[p.inputTokenAccount,p.outputTokenAccount],
   })
  }catch{reasons.push('TRUSTED_SIMULATION_UNAVAILABLE')}
 }
 const secondNow=timestamp(input.host.now())
 if(!Number.isFinite(secondNow)||secondNow<firstNow){
  reasons.push('SIGNER_MONOTONIC_WALL_CLOCK_REGRESSED')
 }
 if(simulation&&decoded){
  const s=simulation
  allow(s.authority==='TRUSTED_UNSIGNED_SIMULATION'&&
   s.transactionSha256===decoded.sha256&&
   s.contextSlot>=p.minContextSlot&&s.blockhash===decoded.blockhash&&
   s.err===null&&s.evidenceIds.length>0,
   reasons,'SIMULATION_TRANSACTION_OR_SLOT_UNTRUSTED')
  allow(s.allInnerInstructionsObserved&&
   s.executedProgramIds.length>=decoded.programIds.length&&
   s.executedProgramIds.every(x=>p.allowedPrograms.includes(x))&&
   decoded.programIds.every(x=>s.executedProgramIds.includes(x)),
   reasons,'UNKNOWN_INNER_PROGRAM_OR_CPI')
  const balances=s.tokenAccounts
  const from=balances.find(x=>x.address===p.inputTokenAccount)
  const to=balances.find(x=>x.address===p.outputTokenAccount)
  allow(balances.length===2&&!!from&&!!to&&from!==to&&
    from.mint===i.inputMint&&to.mint===i.outputMint&&
    from.owner===p.cofferAddress&&to.owner===p.cofferAddress&&
    from.beforeAtomic>=i.inputAmountAtomic&&
    from.beforeAtomic-from.afterAtomic===i.inputAmountAtomic&&
    to.afterAtomic-to.beforeAtomic>=i.minimumOutputAtomic&&
    from.afterAtomic>=0n&&to.beforeAtomic>=0n,
   reasons,'TOKEN_DELTA_OR_DESTINATION_MISMATCH')
  const fees=s.baseFeeLamports+s.priorityFeeLamports+s.jitoTipLamports
  allow([s.baseFeeLamports,s.priorityFeeLamports,s.jitoTipLamports,
    s.extraSolDebitLamports].every(x=>x>=0n)&&
    s.extraSolDebitLamports===0n&&fees<=p.maxFeeLamports&&
    (start?.solFeeReserveLamports??0n)>=fees+p.minSolReserveLamports,
   reasons,'FEE_TIP_OR_UNEXPECTED_SOL_DEBIT')
 }
 // The second independent durable state read detects race/kill/unknown
 // changes during simulation. This cannot substitute for an atomic signer
 // reservation under a lease; no signing capability is returned.
 let finish:SniperSignerGuard|undefined
 try{finish=await input.host.readGuard()}catch{reasons.push('POST_SIM_GUARD_UNAVAILABLE')}
 if(!finish||!start||finish.authority!=='TRUSTED_GUARD_READ'||
   finish.version!==start.version||finish.halted||finish.canary.halted||
   finish.unresolvedExecutionIds.length>0||
   finish.canary.unresolvedExecutionIds.length>0||
   finish.existingIdempotencyKeys.includes(i.idempotencyKey)||
   !Number.isFinite(secondNow)||!fresh(secondNow,finish.observedAt,p.maxEvidenceAgeMs)){
  reasons.push('GUARD_CHANGED_OR_UNVERIFIED_AFTER_SIMULATION')
 }
 // This remains read-only even for a clean simulated route. A genuine
 // signer needs a separately approved atomic state/permit reservation and
 // trusted semantic review of token programs, CPI & side effects.
 const safe=simulation!==undefined&&decoded!==undefined&&reasons.length===0
 return Object.freeze({
  version:'SHARK-SNIPER.SIGNER-CERTIFY.36-40',
  disposition:safe?'RESEARCH_OBSERVATION_MATCHED':'BLOCKED',
  reasonCodes:Object.freeze([...new Set(reasons)]),
  ...(decoded?{transactionSha256:decoded.sha256}:{}),
  lookupTables:Object.freeze(decoded?.lookupTableAddresses??[]),
  ...(simulation?.tokenAccounts.find(x=>x.address===p.outputTokenAccount)
   ?{simulatedOutputAtomic:simulation.tokenAccounts.find(x=>x.address===p.outputTokenAccount)!.afterAtomic}:{}),
  ...(simulation?{simulatedFeesLamports:simulation.baseFeeLamports+
   simulation.priorityFeeLamports+simulation.jitoTipLamports}:{}),
  ...(start?{guardVersion:start.version}:{}),
  canSign:false,canSubmit:false,canRetry:false,canCreditPurse:false,
  authority:'SIGNER_RESEARCH_ONLY',
 })
}
