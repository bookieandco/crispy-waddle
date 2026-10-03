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
  medianExecutableReturnBps?:number
  positiveExecutableReturnRate?:number
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
  if(!finite(input.executableReturnBps))throw new Error('external_signal_outcome_return_invalid')
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
  const migratedCount=migrationObserved.filter(item=>item.migrated===true).length
  const rugCount=rugObserved.filter(item=>item.rug===true).length
  const independentDiscoveryCount=independentObserved.filter(item=>item.independentDiscovery===true).length
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
    medianExecutableReturnBps:median(returns),
    positiveExecutableReturnRate:returns.length?returns.filter(value=>value>0).length/returns.length:undefined,
    migrationRate:migrationObserved.length?migratedCount/migrationObserved.length:undefined,
    rugRate:rugObserved.length?rugCount/rugObserved.length:undefined,
    independentDiscoveryRate:independentObserved.length?independentDiscoveryCount/independentObserved.length:undefined,
    evidenceIds:Object.freeze(evidenceIds),
    authority:'LEARNING_ONLY',
    canAuthorizeTrade:false,
    canAutoCopy:false,
  })
}
