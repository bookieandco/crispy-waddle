import type {SharkDiscoveryObservation,SharkTerminalFee} from './stage-aware-discovery-screen'

export type TerminalFeeSnapshot=Readonly<{
  chainId:'solana'
  mint:string
  terminal:string
  metricName:'GLOBAL_FEES_PAID'|'TOTAL_FEES_PAID'
  metricDefinition:string
  currency:'SOL'
  amount:number
  observedAt:string
  availableAt:string
  evidenceId:string
  /** Immutable provider/version identity, not an arbitrary marketing label. */
  providerVersion:string
}>
export type ChainFeeReceipt=Readonly<{
  signature:string
  slot:number
  feeLamports:number
  observedAt:string
  availableAt:string
  evidenceId:string
  rpcProvider:string
}>
export type TerminalFeeAdaptation=Readonly<{
  mint:string
  availableAt?:string
  status:'DECLARED_UNVERIFIED'|'UNAVAILABLE'
  fee?:SharkTerminalFee
  warnings:readonly string[]
  authority:'FEE_RESEARCH_ONLY'
  canValidateRug:false
}>
const time=(s:string,code:string)=>{
  const n=Date.parse(s)
  if(!s.trim()||!Number.isFinite(n))throw new Error(code)
  return n
}
const nonnegative=(n:number,code:string)=>{
  if(!Number.isFinite(n)||n<0)throw new Error(code)
}
/**
 * Terminal definitions must be copied from the actual provider documentation/
 * receipt. They remain unverified. Never substitute Solana RPC tx fees for
 * GMGN/Axiom global fees unless independent semantics verification permits it.
 */
export function adaptTerminalFeeSnapshot(input:{
  snapshot?:TerminalFeeSnapshot
  mint:string
  cutoff:string
  maxAgeMs?:number
}):TerminalFeeAdaptation{
  const cutoff=time(input.cutoff,'fee_cutoff_invalid')
  if(!input.mint.trim())throw new Error('fee_mint_required')
  const empty=(reason:string):TerminalFeeAdaptation=>Object.freeze({
    mint:input.mint,status:'UNAVAILABLE',warnings:Object.freeze([reason]),authority:'FEE_RESEARCH_ONLY',canValidateRug:false,
  })
  const s=input.snapshot
  if(!s)return empty('terminal_fee_unavailable')
  if(s.chainId!=='solana'||s.mint!==input.mint)throw new Error('fee_mint_binding_invalid')
  if(!s.terminal.trim()||!s.evidenceId.trim()||!s.providerVersion.trim())throw new Error('fee_source_identity_missing')
  nonnegative(s.amount,'fee_amount_invalid')
  const observed=time(s.observedAt,'fee_observed_invalid')
  const available=time(s.availableAt,'fee_available_invalid')
  if(available<observed)throw new Error('fee_source_order_invalid')
  if(available>cutoff)throw new Error('fee_lookahead_forbidden')
  const age=input.maxAgeMs??15000
  nonnegative(age,'fee_age_limit_invalid')
  if(!s.metricDefinition.trim())return empty('terminal_metric_definition_missing')
  if(cutoff-available>age)return empty('terminal_fee_stale')
  if(s.currency!=='SOL'||!['GLOBAL_FEES_PAID','TOTAL_FEES_PAID'].includes(s.metricName))
    throw new Error('fee_unit_or_kind_invalid')
  return Object.freeze({
    mint:input.mint,availableAt:s.availableAt,status:'DECLARED_UNVERIFIED',
    fee:Object.freeze({
      kind:s.metricName,unit:s.currency,amount:s.amount,venue:s.terminal,
      observedAt:s.observedAt,evidenceId:s.evidenceId,
    }),
    warnings:Object.freeze(['terminal_fee_definition_not_independently_verified']),
    authority:'FEE_RESEARCH_ONLY',canValidateRug:false,
  })
}

export type NetworkFeeResearchSummary=Readonly<{
  signatures:number
  networkFeesSol:number
  lastAvailableAt?:string
  evidenceIds:readonly string[]
  measurement:'SOLANA_NETWORK_TX_FEES_ONLY'
  comparableToTerminalGlobalFees:false
  authority:'FEE_RESEARCH_ONLY'
}>

/** Separate read-only native chain-fee evidence; NOT a claimed global-fee reconstruction. */
export function summarizeChainFeeReceipts(input:{
  receipts:readonly ChainFeeReceipt[]
  cutoff:string
}):NetworkFeeResearchSummary{
  const cutoff=time(input.cutoff,'chain_fee_cutoff_invalid')
  const signatures=new Set<string>(),evidenceIds=new Set<string>()
  let lamports=0,last=0
  for(const receipt of input.receipts){
    if(!receipt.signature.trim()||!receipt.evidenceId.trim()||!receipt.rpcProvider.trim())
      throw new Error('chain_fee_identity_invalid')
    if(!Number.isSafeInteger(receipt.feeLamports)||receipt.feeLamports<0||
       !Number.isSafeInteger(receipt.slot)||receipt.slot<0)throw new Error('chain_fee_quantity_invalid')
    const observed=time(receipt.observedAt,'chain_fee_observed_invalid')
    const available=time(receipt.availableAt,'chain_fee_available_invalid')
    if(available<observed||available>cutoff)throw new Error('chain_fee_chronology_invalid')
    if(signatures.has(receipt.signature))throw new Error('chain_fee_duplicate_signature')
    signatures.add(receipt.signature);evidenceIds.add(receipt.evidenceId)
    lamports+=receipt.feeLamports
    if(!Number.isSafeInteger(lamports))throw new Error('chain_fee_overflow')
    last=Math.max(last,available)
  }
  return Object.freeze({
    signatures:signatures.size,networkFeesSol:lamports/1e9,
    lastAvailableAt:last?new Date(last).toISOString():undefined,
    evidenceIds:Object.freeze([...evidenceIds].sort()),
    measurement:'SOLANA_NETWORK_TX_FEES_ONLY',comparableToTerminalGlobalFees:false,
    authority:'FEE_RESEARCH_ONLY',
  })
}

/** Only this normalization point may append terminal fee evidence to a screen. */
export function attachDeclaredTerminalFee(
  observation:SharkDiscoveryObservation,
  adapted:TerminalFeeAdaptation,
):SharkDiscoveryObservation{
  if(!observation.mint.trim()||adapted.mint!==observation.mint)throw new Error('fee_screen_mint_invalid')
  if(adapted.availableAt&&Date.parse(adapted.availableAt)>Date.parse(observation.availableAt))
    throw new Error('fee_screen_future_receipt')
  if(!adapted.fee)return Object.freeze({...observation,fee:undefined})
  const ids=new Set([...observation.evidenceIds,adapted.fee.evidenceId])
  return Object.freeze({...observation,fee:adapted.fee,evidenceIds:Object.freeze([...ids].sort())})
}
