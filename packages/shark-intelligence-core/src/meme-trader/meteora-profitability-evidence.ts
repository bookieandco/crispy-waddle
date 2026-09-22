export type MeteoraDlmmCashFlowKind='DEPOSIT'|'WITHDRAWAL'|'FEE'
export type MeteoraDlmmCashFlowAmountSemantics='NATIVE_TRANSFER'|'VERIFIED_VALUATION'

export type MeteoraDlmmCashFlowEvidence=Readonly<{
  evidenceId:string
  transactionId:string
  position:string
  kind:MeteoraDlmmCashFlowKind
  amountMinor:bigint
  currency:string
  amountSemantics:MeteoraDlmmCashFlowAmountSemantics
  valuationEvidenceIds:readonly string[]
  observedAt:string
  availableAt:string
}>

export type MeteoraDlmmPositionStateEvidence=Readonly<{
  stateId:string
  position:string
  currency:string
  positionClosed:boolean
  transactionHistoryComplete:boolean
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
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
  valuationStatus:'VERIFIED'|'VALUATION_REQUIRED'
  impermanentLossMinor:null
  impermanentLossStatus:'BENCHMARK_REQUIRED'
  evidenceIds:readonly string[]
  excludedFutureEvidenceIds:readonly string[]
  authority:'RESEARCH_ONLY'
}>

const assertIso=(v:string,code:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(code)}

export function assertMeteoraDlmmCashFlowEvidence(flow:MeteoraDlmmCashFlowEvidence):void{
  if(!flow.evidenceId.trim()||!flow.transactionId.trim()||!flow.position.trim()||!flow.currency.trim())throw new Error('meteora_profitability_flow_identity_required')
  if(flow.amountMinor<0n)throw new Error('meteora_profitability_negative_amount')
  if(!['DEPOSIT','WITHDRAWAL','FEE'].includes(flow.kind))throw new Error('meteora_profitability_flow_kind_invalid')
  if(!['NATIVE_TRANSFER','VERIFIED_VALUATION'].includes(flow.amountSemantics))throw new Error('meteora_profitability_amount_semantics_invalid')
  const valuationIds=[...new Set(flow.valuationEvidenceIds)]
  if(flow.amountSemantics==='VERIFIED_VALUATION'&&!valuationIds.length)throw new Error('meteora_profitability_valuation_evidence_required')
  if(flow.amountSemantics==='NATIVE_TRANSFER'&&valuationIds.length)throw new Error('meteora_profitability_native_flow_has_valuation_evidence')
  assertIso(flow.observedAt,'meteora_profitability_observed_at_invalid')
  assertIso(flow.availableAt,'meteora_profitability_available_at_invalid')
  if(Date.parse(flow.availableAt)<Date.parse(flow.observedAt))throw new Error('meteora_profitability_availability_invalid')
}

export function assertMeteoraDlmmPositionStateEvidence(state:MeteoraDlmmPositionStateEvidence):void{
  if(!state.stateId.trim()||!state.position.trim()||!state.currency.trim()||!state.evidenceIds.length)throw new Error('meteora_profitability_state_identity_required')
  assertIso(state.observedAt,'meteora_profitability_state_observed_at_invalid')
  assertIso(state.availableAt,'meteora_profitability_state_available_at_invalid')
  if(Date.parse(state.availableAt)<Date.parse(state.observedAt))throw new Error('meteora_profitability_state_availability_invalid')
}

export function reconcileMeteoraDlmmCashFlowProfitability(input:{
  position:string
  currency:string
  flows:readonly MeteoraDlmmCashFlowEvidence[]
  informationCutoff:string
  positionClosed:boolean
  transactionHistoryComplete:boolean
  positionStateEvidenceIds?:readonly string[]
}):MeteoraDlmmProfitabilityEvidence{
  if(!input.position.trim()||!input.currency.trim())throw new Error('meteora_profitability_identity_required')
  assertIso(input.informationCutoff,'meteora_profitability_cutoff_invalid')
  const ids=new Set<string>()
  for(const flow of input.flows){
    assertMeteoraDlmmCashFlowEvidence(flow)
    if(flow.position!==input.position||flow.currency!==input.currency)throw new Error('meteora_profitability_flow_identity_mismatch')
    if(ids.has(flow.evidenceId))throw new Error('meteora_profitability_duplicate_evidence')
    ids.add(flow.evidenceId)
  }
  const cutoff=Date.parse(input.informationCutoff)
  const eligible=input.flows.filter(flow=>Date.parse(flow.availableAt)<=cutoff)
  const future=input.flows.filter(flow=>Date.parse(flow.availableAt)>cutoff)
  if(!eligible.length)throw new Error('meteora_profitability_evidence_required')
  const sum=(kind:MeteoraDlmmCashFlowKind)=>eligible.filter(flow=>flow.kind===kind).reduce((n,flow)=>n+flow.amountMinor,0n)
  const depositsMinor=sum('DEPOSIT'),withdrawalsMinor=sum('WITHDRAWAL'),feesMinor=sum('FEE')
  const netCashFlowMinor=withdrawalsMinor+feesMinor-depositsMinor
  // Point-in-time status is determined only by evidence available at the cutoff.
  // Future rows are listed for replay diagnostics but cannot retroactively alter
  // whether the position was believed closed/complete at that historical time.
  const realizationStatus:MeteoraDlmmProfitabilityEvidence['realizationStatus']=
    !input.transactionHistoryComplete?'PROVISIONAL_INCOMPLETE':input.positionClosed?'CLOSED_COMPLETE':'PROVISIONAL_OPEN'
  const valuationVerified=eligible.every(flow=>flow.amountSemantics==='VERIFIED_VALUATION'&&flow.valuationEvidenceIds.length>0)
  const valuationStatus:MeteoraDlmmProfitabilityEvidence['valuationStatus']=valuationVerified?'VERIFIED':'VALUATION_REQUIRED'
  const evidenceIds=[...new Set([
    ...eligible.flatMap(flow=>[flow.evidenceId,...flow.valuationEvidenceIds]),
    ...(input.positionStateEvidenceIds??[]),
  ])].sort()
  return Object.freeze({
    position:input.position,
    currency:input.currency,
    informationCutoff:input.informationCutoff,
    depositsMinor,
    withdrawalsMinor,
    feesMinor,
    netCashFlowMinor,
    realizedPnlMinor:realizationStatus==='CLOSED_COMPLETE'&&valuationVerified?netCashFlowMinor:null,
    realizationStatus,
    valuationStatus,
    // True impermanent loss requires a counterfactual HODL benchmark at matched
    // prices/times. Cash-flow delta alone must never be relabeled as IL.
    impermanentLossMinor:null,
    impermanentLossStatus:'BENCHMARK_REQUIRED',
    evidenceIds:Object.freeze(evidenceIds),
    excludedFutureEvidenceIds:Object.freeze(future.map(flow=>flow.evidenceId).sort()),
    authority:'RESEARCH_ONLY',
  })
}

export function reconcileMeteoraDlmmCashFlowProfitabilityFromState(input:{
  position:string
  currency:string
  flows:readonly MeteoraDlmmCashFlowEvidence[]
  informationCutoff:string
  state:MeteoraDlmmPositionStateEvidence
}):MeteoraDlmmProfitabilityEvidence{
  assertMeteoraDlmmPositionStateEvidence(input.state)
  if(input.state.position!==input.position||input.state.currency!==input.currency)throw new Error('meteora_profitability_state_identity_mismatch')
  if(Date.parse(input.state.availableAt)>Date.parse(input.informationCutoff))throw new Error('meteora_profitability_state_after_cutoff')
  return reconcileMeteoraDlmmCashFlowProfitability({
    position:input.position,
    currency:input.currency,
    flows:input.flows,
    informationCutoff:input.informationCutoff,
    positionClosed:input.state.positionClosed,
    transactionHistoryComplete:input.state.transactionHistoryComplete,
    positionStateEvidenceIds:input.state.evidenceIds,
  })
}
