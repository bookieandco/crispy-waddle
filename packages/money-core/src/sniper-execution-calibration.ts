import type {DexRouteProvider} from './dex-route-gate.js'
export const SNIPER_EXEC_CALIBRATION_VERSION='SHARK-SNIPER.FASTPATH.06' as const
export type SniperExecutionSample=Readonly<{
 sampleId:string
 chainId:'solana-mainnet'
 venue:DexRouteProvider
 side:'BUY'|'SELL'
 quoteObservedAt:string
 submittedAt:string
 settledAt:string
 observedAt:string
 observedSlippageBps:number
 baseFeeLamports:bigint
 priorityFeeLamports:bigint
 jitoTipLamports:bigint
 nonRecoverableRentLamports:bigint
 outcome:'CONFIRMED_FILL'|'FAILED'|'UNKNOWN'
 source:'CONFIRMED_ONCHAIN'|'PAPER_SIMULATION'
 signature?:string
 evidenceIds:readonly string[]
}>
export type SniperExecutionCalibration=Readonly<{
 version:typeof SNIPER_EXEC_CALIBRATION_VERSION
 status:'EVIDENCE_INSUFFICIENT'|'OBSERVATION_ONLY'
 venue:DexRouteProvider
 side:'BUY'|'SELL'
 eligibleSampleCount:number
 failedCount:number
 unresolvedCount:number
 p90AdverseSlippageBps?:number
 p90FixedFeeLamports?:bigint
 candidateSlippageBudgetBps?:number
 evidenceIds:readonly string[]
 authority:'CALIBRATION_RESEARCH_ONLY'
 canExecute:false
 canChangeMoneyLimits:false
}>
const percentile=<T>(values:readonly T[],q:number):T|undefined=>values.length?values[Math.ceil(q*values.length)-1]:undefined
/** Never self-adjust the admitted owner slippage cap or priority fee limit.
 * Only confirmed independent on-chain outcomes are eligible to calibrate.
 * Failed submissions count toward failure rates but cannot masquerade as fills.
 */
export function calibrateSniperExecution(input:{
  samples:readonly SniperExecutionSample[]
  venue:DexRouteProvider
  side:'BUY'|'SELL'
  cutoff:string
  minConfirmedSamples?:number
  maximumCandidateSlippageBps:number
  slippageBufferBps:number
}):SniperExecutionCalibration{
 const cutoffMs=Date.parse(input.cutoff),floor=input.minConfirmedSamples??30
 if(!Number.isFinite(cutoffMs)||!Number.isSafeInteger(floor)||floor<10||
  !Number.isSafeInteger(input.maximumCandidateSlippageBps)||input.maximumCandidateSlippageBps<0||input.maximumCandidateSlippageBps>10000||
  !Number.isSafeInteger(input.slippageBufferBps)||input.slippageBufferBps<0||input.slippageBufferBps>10000){
  throw new Error('SNIPER_CALIBRATION_POLICY_INVALID')
 }
 const eligible:SniperExecutionSample[]=[]
 const failure:SniperExecutionSample[]=[]
 const unknown:SniperExecutionSample[]=[]
 const ids=new Set<string>()
 const seen=new Set<string>()
 for(const s of input.samples){
  if(s.venue!==input.venue||s.side!==input.side)continue
  if(!s.sampleId.trim()||!s.evidenceIds.length||!Number.isSafeInteger(s.observedSlippageBps)||
     Math.abs(s.observedSlippageBps)>10000||s.baseFeeLamports<0n||s.priorityFeeLamports<0n||
     s.jitoTipLamports<0n||s.nonRecoverableRentLamports<0n)throw new Error('SNIPER_CALIBRATION_SAMPLE_INVALID')
  const q=Date.parse(s.quoteObservedAt),submitted=Date.parse(s.submittedAt),settled=Date.parse(s.settledAt),observed=Date.parse(s.observedAt)
  if(!Number.isFinite(q)||!Number.isFinite(submitted)||!Number.isFinite(settled)||!Number.isFinite(observed)||
    q>submitted||submitted>settled||settled>observed)throw new Error('SNIPER_CALIBRATION_TIME_INVALID')
  if(observed>cutoffMs||s.source!=='CONFIRMED_ONCHAIN'||s.chainAttestation!=='INDEPENDENT_RPC_VERIFIED')continue
  if(seen.has(s.sampleId))continue
  seen.add(s.sampleId)
  s.evidenceIds.forEach(id=>ids.add(id))
  if(s.outcome==='CONFIRMED_FILL'){
   if(!s.signature?.trim())throw new Error('SNIPER_CALIBRATION_CHAIN_SIGNATURE_REQUIRED')
   eligible.push(s)
  }else if(s.outcome==='FAILED')failure.push(s)
  else unknown.push(s)
 }
 const qualified=eligible.length>=floor
 const slippages=eligible.map(s=>Math.max(0,s.observedSlippageBps)).sort((a,b)=>a-b)
 const fees=eligible.map(s=>s.baseFeeLamports+s.priorityFeeLamports+s.jitoTipLamports+s.nonRecoverableRentLamports)
   .sort((a,b)=>a<b?-1:a>b?1:0)
 const p90Slippage=qualified?percentile(slippages,.9):undefined
 const p90Fee=qualified?percentile(fees,.9):undefined
 return Object.freeze({
  version:SNIPER_EXEC_CALIBRATION_VERSION,status:qualified?'OBSERVATION_ONLY':'EVIDENCE_INSUFFICIENT',
  venue:input.venue,side:input.side,eligibleSampleCount:eligible.length,
  failedCount:failure.length,unresolvedCount:unknown.length,
  p90AdverseSlippageBps:p90Slippage,p90FixedFeeLamports:p90Fee,
  candidateSlippageBudgetBps:p90Slippage===undefined?undefined:
   Math.min(input.maximumCandidateSlippageBps,p90Slippage+input.slippageBufferBps),
  evidenceIds:Object.freeze([...ids].sort()),authority:'CALIBRATION_RESEARCH_ONLY',
  canExecute:false,canChangeMoneyLimits:false,
 })
}
