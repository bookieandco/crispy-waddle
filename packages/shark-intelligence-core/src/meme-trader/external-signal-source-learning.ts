import type { ExternalSignalPlatform } from './external-signal-ingest'

export type ExternalSignalOutcome = Readonly<{
  outcomeId:string
  platform:ExternalSignalPlatform
  sourceHandle:string
  channelId?:string
  signalObservationId:string
  tokenCandidate:string
  observedAt:string
  resolvedAt:string
  leadTimeMs?:number
  executionLatencyMs?:number
  callMarketCapUsd?:number
  maxFavorableExcursionBps?:number
  maxAdverseExcursionBps?:number
  firstIndependentCaller?:boolean
  migrated?:boolean
  rug?:boolean
  executableReturnBps?:number
  independentDiscovery?:boolean
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeTrade:false
  canAutoCopy:false
}>

export type ExternalSignalSourceSummary = Readonly<{
  sourceKey:string
  platform:ExternalSignalPlatform
  sourceHandle:string
  channelId?:string
  sampleSize:number
  resolvedReturnSamples:number
  migrationSamples:number
  migratedCount:number
  rugCount:number
  independentDiscoveryCount:number
  medianLeadTimeMs?:number
  medianExecutionLatencyMs?:number
  medianCallMarketCapUsd?:number
  medianExecutableReturnBps?:number
  medianMaxFavorableExcursionBps?:number
  medianMaxAdverseExcursionBps?:number
  positiveExecutableReturnRate?:number
  twoXExecutableRate?:number
  firstIndependentCallerRate?:number
  tailWinnerDependence?:number
  migrationRate?:number
  rugRate?:number
  independentDiscoveryRate?:number
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeTrade:false
  canAutoCopy:false
}>

const assertIso=(value:string,code:string)=>{
  if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)
}
const finite=(value:number|undefined)=>value===undefined||Number.isFinite(value)
const median=(values:readonly number[]):number|undefined=>{
  if(!values.length)return undefined
  const xs=[...values].sort((a,b)=>a-b)
  const i=Math.floor(xs.length/2)
  return xs.length%2?xs[i]:(xs[i-1]!+xs[i]!)/2
}
const sourceKey=(input:{platform:ExternalSignalPlatform;sourceHandle:string;channelId?:string})=>
  [input.platform,input.sourceHandle.trim().toLowerCase(),input.channelId?.trim().toLowerCase()??''].join(':')

export function createExternalSignalOutcome(input:Omit<ExternalSignalOutcome,'authority'|'canAuthorizeTrade'|'canAutoCopy'>):ExternalSignalOutcome{
  if(!input.outcomeId.trim()||!input.sourceHandle.trim()||!input.signalObservationId.trim()||!input.tokenCandidate.trim())throw new Error('external_signal_outcome_identity_required')
  assertIso(input.observedAt,'external_signal_outcome_observed_at_invalid')
  assertIso(input.resolvedAt,'external_signal_outcome_resolved_at_invalid')
  if(Date.parse(input.resolvedAt)<Date.parse(input.observedAt))throw new Error('external_signal_outcome_clock_invalid')
  if(input.leadTimeMs!==undefined&&(!Number.isFinite(input.leadTimeMs)||input.leadTimeMs<0))throw new Error('external_signal_outcome_lead_time_invalid')
  if(input.executionLatencyMs!==undefined&&(!Number.isFinite(input.executionLatencyMs)||input.executionLatencyMs<0))throw new Error('external_signal_outcome_execution_latency_invalid')
  if(input.callMarketCapUsd!==undefined&&(!Number.isFinite(input.callMarketCapUsd)||input.callMarketCapUsd<0))throw new Error('external_signal_outcome_call_market_cap_invalid')
  if(!finite(input.maxFavorableExcursionBps)||!finite(input.maxAdverseExcursionBps)||!finite(input.executableReturnBps))throw new Error('external_signal_outcome_return_invalid')
  if(!input.evidenceIds.length)throw new Error('external_signal_outcome_evidence_required')
  return Object.freeze({
    ...input,
    sourceHandle:input.sourceHandle.trim(),
    channelId:input.channelId?.trim()||undefined,
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority:'LEARNING_ONLY',
    canAuthorizeTrade:false,
    canAutoCopy:false,
  })
}

/**
 * Descriptive source learning only. A strong source history may raise research priority,
 * but it can never convert a Telegram/Discord/X message into trade or copy authority.
 */
export function summarizeExternalSignalSource(outcomes:readonly ExternalSignalOutcome[]):ExternalSignalSourceSummary{
  if(!outcomes.length)throw new Error('external_signal_source_outcomes_required')
  const first=outcomes[0]!
  const key=sourceKey(first)
  if(outcomes.some(item=>sourceKey(item)!==key))throw new Error('external_signal_source_mixed_identity')

  const returns=outcomes.flatMap(item=>item.executableReturnBps===undefined?[]:[item.executableReturnBps])
  const migrationObserved=outcomes.filter(item=>item.migrated!==undefined)
  const rugObserved=outcomes.filter(item=>item.rug!==undefined)
  const independentObserved=outcomes.filter(item=>item.independentDiscovery!==undefined)
  const leadTimes=outcomes.flatMap(item=>item.leadTimeMs===undefined?[]:[item.leadTimeMs])
  const executionLatencies=outcomes.flatMap(item=>item.executionLatencyMs===undefined?[]:[item.executionLatencyMs])
  const callMarketCaps=outcomes.flatMap(item=>item.callMarketCapUsd===undefined?[]:[item.callMarketCapUsd])
  const mfes=outcomes.flatMap(item=>item.maxFavorableExcursionBps===undefined?[]:[item.maxFavorableExcursionBps])
  const maes=outcomes.flatMap(item=>item.maxAdverseExcursionBps===undefined?[]:[item.maxAdverseExcursionBps])
  const firstIndependentObserved=outcomes.filter(item=>item.firstIndependentCaller!==undefined)
  const migratedCount=migrationObserved.filter(item=>item.migrated===true).length
  const rugCount=rugObserved.filter(item=>item.rug===true).length
  const independentDiscoveryCount=independentObserved.filter(item=>item.independentDiscovery===true).length
  const firstIndependentCallerCount=firstIndependentObserved.filter(item=>item.firstIndependentCaller===true).length
  const positiveReturns=returns.filter(value=>value>0)
  const positiveReturnTotal=positiveReturns.reduce((sum,value)=>sum+value,0)
  const largestPositiveReturn=positiveReturns.length?Math.max(...positiveReturns):0
  const evidenceIds=[...new Set(outcomes.flatMap(item=>item.evidenceIds))].sort()

  return Object.freeze({
    sourceKey:key,
    platform:first.platform,
    sourceHandle:first.sourceHandle,
    channelId:first.channelId,
    sampleSize:outcomes.length,
    resolvedReturnSamples:returns.length,
    migrationSamples:migrationObserved.length,
    migratedCount,
    rugCount,
    independentDiscoveryCount,
    medianLeadTimeMs:median(leadTimes),
    medianExecutionLatencyMs:median(executionLatencies),
    medianCallMarketCapUsd:median(callMarketCaps),
    medianExecutableReturnBps:median(returns),
    medianMaxFavorableExcursionBps:median(mfes),
    medianMaxAdverseExcursionBps:median(maes),
    positiveExecutableReturnRate:returns.length?positiveReturns.length/returns.length:undefined,
    twoXExecutableRate:returns.length?returns.filter(value=>value>=10_000).length/returns.length:undefined,
    firstIndependentCallerRate:firstIndependentObserved.length?firstIndependentCallerCount/firstIndependentObserved.length:undefined,
    tailWinnerDependence:positiveReturnTotal>0?largestPositiveReturn/positiveReturnTotal:undefined,
    migrationRate:migrationObserved.length?migratedCount/migrationObserved.length:undefined,
    rugRate:rugObserved.length?rugCount/rugObserved.length:undefined,
    independentDiscoveryRate:independentObserved.length?independentDiscoveryCount/independentObserved.length:undefined,
    evidenceIds:Object.freeze(evidenceIds),
    authority:'LEARNING_ONLY',
    canAuthorizeTrade:false,
    canAutoCopy:false,
  })
}
