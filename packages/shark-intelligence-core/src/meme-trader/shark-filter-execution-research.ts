/** Research-only event-to-exit timing. Never conflate a quick lookup with fills. */
export type SharkFilterLatencyStage=
  |'eventVisible'|'sourceAvailable'|'ingested'|'screened'|'safetyChecked'
  |'proposalCreated'|'entryQuoteObserved'|'transactionBuilt'|'submitted'
  |'landed'|'confirmed'|'exitQuoteObserved'|'exitLanded'
export const SHARK_FILTER_LATENCY_STAGES:readonly SharkFilterLatencyStage[]=[
  'eventVisible','sourceAvailable','ingested','screened','safetyChecked',
  'proposalCreated','entryQuoteObserved','transactionBuilt','submitted',
  'landed','confirmed','exitQuoteObserved','exitLanded',
]
export type LatencyTrace=Readonly<{
  traceId:string
  origin:'REAL_PROVIDER_RECEIPTS'|'SYNTHETIC_FIXTURE'
  occurredAt:Partial<Record<SharkFilterLatencyStage,string>>
  evidenceIds:readonly string[]
}>
export type LatencyMeasurement=Readonly<{
  traceId:string
  segments:readonly Readonly<{from:SharkFilterLatencyStage;to:SharkFilterLatencyStage;milliseconds:number}>[]
  eventToScreenMs?:number
  eventToLandingMs?:number
  eventToExitMs?:number
  endToEndConfirmed:boolean
  missingStages:readonly SharkFilterLatencyStage[]
  origin:'REAL_PROVIDER_RECEIPTS'|'SYNTHETIC_FIXTURE'
  authority:'LATENCY_RESEARCH_ONLY'
  canClaimExecutableFill:false
}>
const timestamp=(s:string,code:string)=>{
  const t=Date.parse(s)
  if(!s.trim()||!Number.isFinite(t))throw new Error(code)
  return t
}
export function measureSharkFilterLatency(trace:LatencyTrace):LatencyMeasurement{
  if(!trace.traceId.trim()||!trace.evidenceIds.length||trace.evidenceIds.some(s=>!s.trim()))
    throw new Error('shark_latency_identity_missing')
  const stamps=new Map<SharkFilterLatencyStage,number>()
  let prev:number|undefined
  const segments:LatencyMeasurement['segments'][number][]=[]
  let previousStage:SharkFilterLatencyStage|undefined
  for(const stage of SHARK_FILTER_LATENCY_STAGES){
    const at=trace.occurredAt[stage]
    if(at===undefined)continue
    const millis=timestamp(at,'shark_latency_time_invalid')
    if(prev!==undefined&&millis<prev)throw new Error('shark_latency_out_of_order')
    if(previousStage!==undefined&&prev!==undefined)segments.push(Object.freeze({
      from:previousStage,to:stage,milliseconds:millis-prev,
    }))
    stamps.set(stage,millis);prev=millis;previousStage=stage
  }
  if(stamps.size===0)throw new Error('shark_latency_no_measurements')
  const delta=(a:SharkFilterLatencyStage,b:SharkFilterLatencyStage)=>{
    const x=stamps.get(a),y=stamps.get(b)
    return x===undefined||y===undefined?undefined:y-x
  }
  // Entry fill means on-chain evidence must exist; stages are never inferred.
  const landingComplete=['eventVisible','submitted','landed','confirmed']
    .every(s=>stamps.has(s as SharkFilterLatencyStage))
  return Object.freeze({
    traceId:trace.traceId,segments:Object.freeze(segments),
    eventToScreenMs:delta('eventVisible','screened'),
    eventToLandingMs:landingComplete?delta('eventVisible','landed'):undefined,
    eventToExitMs:stamps.has('exitLanded')?delta('eventVisible','exitLanded'):undefined,
    endToEndConfirmed:landingComplete&&stamps.has('exitLanded')&&trace.origin==='REAL_PROVIDER_RECEIPTS',
    missingStages:Object.freeze(SHARK_FILTER_LATENCY_STAGES.filter(s=>!stamps.has(s))),
    origin:trace.origin,authority:'LATENCY_RESEARCH_ONLY',canClaimExecutableFill:false,
  })
}

export type QuoteCostEvidence=Readonly<{
  quoteId:string
  tokenMint:string
  source:'READ_ONLY_DEX_ROUTE_QUOTE'
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  /** Amounts in USD, independently quoted; not a live fill. */
  notionalUsd:number
  liquidityAvailable:boolean
  sellable:boolean
  networkFeeUsd:number
  priorityFeeUsd:number
  jitoTipUsd:number
  swapFeeUsd:number
  slippageUsd:number
  priceImpactUsd:number
  tokenTaxUsd:number
}>
export type SharkShadowRoundTrip=Readonly<{
  state:'NO_FILL'|'INDICATIVE_ONLY'
  entryQuoteId?:string
  exitQuoteId?:string
  grossDeltaUsd?:number
  modeledCostsUsd?:number
  indicativeNetUsd?:number
  blockers:readonly string[]
  evidenceIds:readonly string[]
  authority:'SHADOW_ESTIMATE_NOT_REALIZED_PNL'
  canAuthorizeTrade:false
}>
function quote(q:QuoteCostEvidence,cutoff:number,earliest:number):number{
  if(!q.quoteId.trim()||!q.tokenMint.trim()||!q.evidenceIds.length||q.evidenceIds.some(x=>!x.trim()))
    throw new Error('shark_shadow_quote_identity_missing')
  const observed=timestamp(q.observedAt,'shark_shadow_quote_time_invalid')
  const available=timestamp(q.availableAt,'shark_shadow_quote_available_invalid')
  if(available<observed||available>cutoff||observed<earliest)
    throw new Error('shark_shadow_quote_lookahead_or_order_invalid')
  for(const key of [
    'notionalUsd','networkFeeUsd','priorityFeeUsd','jitoTipUsd','swapFeeUsd',
    'slippageUsd','priceImpactUsd','tokenTaxUsd',
  ] as const){
    if(!Number.isFinite(q[key])||q[key]<0)throw new Error('shark_shadow_quote_amount_invalid')
  }
  return available
}
/** Cannot claim return without both independently captured decision/exit quotes. */
export function estimateSharkShadowRoundTrip(input:{
  mint:string
  decisionAt:string
  evaluatedAt:string
  entry?:QuoteCostEvidence
  exit?:QuoteCostEvidence
}):SharkShadowRoundTrip{
  const decision=timestamp(input.decisionAt,'shark_shadow_decision_invalid')
  const evaluation=timestamp(input.evaluatedAt,'shark_shadow_evaluation_invalid')
  if(evaluation<decision)throw new Error('shark_shadow_evaluation_before_decision')
  const blockers:string[]=[]
  if(!input.entry)blockers.push('entry_quote_missing')
  if(!input.exit)blockers.push('exit_quote_missing')
  if(input.entry&&input.entry.tokenMint!==input.mint)throw new Error('shark_shadow_entry_asset_mismatch')
  if(input.exit&&input.exit.tokenMint!==input.mint)throw new Error('shark_shadow_exit_asset_mismatch')
  const entryAt=input.entry?quote(input.entry,evaluation,decision):undefined
  if(input.exit)quote(input.exit,evaluation,entryAt??decision)
  if(input.entry&&(!input.entry.liquidityAvailable||!input.entry.sellable))
    blockers.push('entry_route_not_sellable')
  if(input.exit&&(!input.exit.liquidityAvailable||!input.exit.sellable))
    blockers.push('exit_route_not_sellable')
  const evidenceIds=Object.freeze([...new Set([
    ...(input.entry?.evidenceIds??[]),...(input.exit?.evidenceIds??[]),
  ])].sort())
  if(blockers.length)return Object.freeze({
    state:'NO_FILL',entryQuoteId:input.entry?.quoteId,exitQuoteId:input.exit?.quoteId,
    blockers:Object.freeze(blockers),evidenceIds,
    authority:'SHADOW_ESTIMATE_NOT_REALIZED_PNL',canAuthorizeTrade:false,
  })
  const entry=input.entry!,exit=input.exit!
  const cost=(q:QuoteCostEvidence)=>q.networkFeeUsd+q.priorityFeeUsd+q.jitoTipUsd+
    q.swapFeeUsd+q.slippageUsd+q.priceImpactUsd+q.tokenTaxUsd
  const modeledCostsUsd=cost(entry)+cost(exit)
  const grossDeltaUsd=exit.notionalUsd-entry.notionalUsd
  return Object.freeze({
    state:'INDICATIVE_ONLY',entryQuoteId:entry.quoteId,exitQuoteId:exit.quoteId,
    grossDeltaUsd,modeledCostsUsd,indicativeNetUsd:grossDeltaUsd-modeledCostsUsd,
    blockers:Object.freeze([]),evidenceIds,
    authority:'SHADOW_ESTIMATE_NOT_REALIZED_PNL',canAuthorizeTrade:false,
  })
}
