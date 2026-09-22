export type MeteoraDlmmCashFlowKind='DEPOSIT'|'WITHDRAWAL'|'FEE'

export type MeteoraDlmmCashFlowEvidence=Readonly<{
  evidenceId:string
  transactionId:string
  position:string
  kind:MeteoraDlmmCashFlowKind
  amountMinor:bigint
  currency:string
  observedAt:string
  availableAt:string
}>

export type MeteoraDlmmProfitabilityEvidence=Readonly<{
  position:string
  currency:string
  informationCutoff:string
  depositsMinor:bigint
  withdrawalsMinor:bigint
  feesMinor:bigint
  netCashFlowMinor:bigint
  realizedPnlMinor:bigint|null
  realizationStatus:'CLOSED_COMPLETE'|'PROVISIONAL_OPEN'|'PROVISIONAL_INCOMPLETE'
  impermanentLossMinor:null
  impermanentLossStatus:'BENCHMARK_REQUIRED'
  evidenceIds:readonly string[]
  excludedFutureEvidenceIds:readonly string[]
  authority:'RESEARCH_ONLY'
}>

const assertIso=(v:string,code:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(code)}

export function reconcileMeteoraDlmmCashFlowProfitability(input:{
  position:string
  currency:string
  flows:readonly MeteoraDlmmCashFlowEvidence[]
  informationCutoff:string
  positionClosed:boolean
  transactionHistoryComplete:boolean
}):MeteoraDlmmProfitabilityEvidence{
  if(!input.position.trim()||!input.currency.trim())throw new Error('meteora_profitability_identity_required')
  assertIso(input.informationCutoff,'meteora_profitability_cutoff_invalid')
  const ids=new Set<string>()
  for(const flow of input.flows){
    if(!flow.evidenceId.trim()||!flow.transactionId.trim()||flow.position!==input.position||flow.currency!==input.currency)throw new Error('meteora_profitability_flow_identity_mismatch')
    if(ids.has(flow.evidenceId))throw new Error('meteora_profitability_duplicate_evidence')
    ids.add(flow.evidenceId)
    if(flow.amountMinor<0n)throw new Error('meteora_profitability_negative_amount')
    assertIso(flow.observedAt,'meteora_profitability_observed_at_invalid')
    assertIso(flow.availableAt,'meteora_profitability_available_at_invalid')
    if(Date.parse(flow.availableAt)<Date.parse(flow.observedAt))throw new Error('meteora_profitability_availability_invalid')
  }
  const cutoff=Date.parse(input.informationCutoff)
  const eligible=input.flows.filter(flow=>Date.parse(flow.availableAt)<=cutoff)
  const future=input.flows.filter(flow=>Date.parse(flow.availableAt)>cutoff)
  if(!eligible.length)throw new Error('meteora_profitability_evidence_required')
  const sum=(kind:MeteoraDlmmCashFlowKind)=>eligible.filter(flow=>flow.kind===kind).reduce((n,flow)=>n+flow.amountMinor,0n)
  const depositsMinor=sum('DEPOSIT'),withdrawalsMinor=sum('WITHDRAWAL'),feesMinor=sum('FEE')
  const netCashFlowMinor=withdrawalsMinor+feesMinor-depositsMinor
  const historyComplete=input.transactionHistoryComplete&&future.length===0
  const realizationStatus:MeteoraDlmmProfitabilityEvidence['realizationStatus']=
    !historyComplete?'PROVISIONAL_INCOMPLETE':input.positionClosed?'CLOSED_COMPLETE':'PROVISIONAL_OPEN'
  return Object.freeze({
    position:input.position,
    currency:input.currency,
    informationCutoff:input.informationCutoff,
    depositsMinor,
    withdrawalsMinor,
    feesMinor,
    netCashFlowMinor,
    realizedPnlMinor:realizationStatus==='CLOSED_COMPLETE'?netCashFlowMinor:null,
    realizationStatus,
    // True impermanent loss requires a counterfactual HODL benchmark at matched
    // prices/times. Cash-flow delta alone must never be relabeled as IL.
    impermanentLossMinor:null,
    impermanentLossStatus:'BENCHMARK_REQUIRED',
    evidenceIds:Object.freeze([...new Set(eligible.map(flow=>flow.evidenceId))].sort()),
    excludedFutureEvidenceIds:Object.freeze(future.map(flow=>flow.evidenceId).sort()),
    authority:'RESEARCH_ONLY',
  })
}

export type MeteoraDlmmBenchmarkEvidence=Readonly<{
  benchmarkId:string
  position:string
  currency:string
  informationCutoff:string
  lpTerminalValueMinor:bigint
  hodlTerminalValueMinor:bigint
  methodology:'MATCHED_ENTRY_HODL'
  evidenceIds:readonly string[]
}>

export type MeteoraDlmmEstimatedEconomics=Readonly<{
  position:string
  currency:string
  informationCutoff:string
  lpTerminalValueMinor:bigint
  hodlTerminalValueMinor:bigint
  estimatedImpermanentLossMinor:bigint
  methodology:'MATCHED_ENTRY_HODL'
  status:'ESTIMATED_NOT_REALIZED'
  evidenceIds:readonly string[]
  authority:'RESEARCH_ONLY'
}>

export function estimateMeteoraDlmmImpermanentLoss(input:MeteoraDlmmBenchmarkEvidence):MeteoraDlmmEstimatedEconomics{
  if(!input.benchmarkId.trim()||!input.position.trim()||!input.currency.trim()||!input.evidenceIds.length)throw new Error('meteora_benchmark_identity_required')
  assertIso(input.informationCutoff,'meteora_benchmark_cutoff_invalid')
  if(input.lpTerminalValueMinor<0n||input.hodlTerminalValueMinor<0n)throw new Error('meteora_benchmark_value_invalid')
  return Object.freeze({
    position:input.position,
    currency:input.currency,
    informationCutoff:input.informationCutoff,
    lpTerminalValueMinor:input.lpTerminalValueMinor,
    hodlTerminalValueMinor:input.hodlTerminalValueMinor,
    estimatedImpermanentLossMinor:input.lpTerminalValueMinor-input.hodlTerminalValueMinor,
    methodology:'MATCHED_ENTRY_HODL',
    status:'ESTIMATED_NOT_REALIZED',
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority:'RESEARCH_ONLY',
  })
}
