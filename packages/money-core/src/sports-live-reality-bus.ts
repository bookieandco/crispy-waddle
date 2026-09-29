import {createHash} from 'node:crypto'
import type {SportsEventStatus,SportsRealityObservation,SportsRealityObservationKind} from './sports-prediction-reality.js'

export type SportsLiveSourceClass='OFFICIAL'|'MARKET'|'MANUAL_VERIFIED'

export type SportsLiveFeedObservation=Readonly<{
  provider:string
  sourceClass:SportsLiveSourceClass
  sequence:number
  eventId:string
  eventStatus:SportsEventStatus
  subjectId:string
  kind:SportsRealityObservationKind
  value:string|number|boolean
  unit?:string
  observedAt:string
  availableAt:string
  receivedAt:string
  sourceLocator?:string
  evidenceIds:readonly string[]
}>

export type SportsLiveRealityUpdate=Readonly<{
  updateId:string
  provider:string
  sourceClass:SportsLiveSourceClass
  sequence:number
  eventId:string
  eventStatus:SportsEventStatus
  observation:SportsRealityObservation
  receivedAt:string
  canonicalRealityEligible:boolean
  authority:'LIVE_REALITY_EVIDENCE_ONLY'
  canAuthorizeBet:false
  canExecute:false
}>

export type SportsLiveRealitySubscriber=(update:SportsLiveRealityUpdate)=>Promise<void>|void

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const nonEmpty=(value:string,code:string):void=>{if(!value.trim())throw new Error(code)}
const instant=(value:string,code:string):number=>{nonEmpty(value,code);const parsed=Date.parse(value);if(Number.isNaN(parsed))throw new Error(code);return parsed}
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

export function normalizeSportsLiveFeedObservation(input:SportsLiveFeedObservation):SportsLiveRealityUpdate{
  nonEmpty(input.provider,'SPORT_AUTO_LIVE_PROVIDER_REQUIRED')
  nonEmpty(input.eventId,'SPORT_AUTO_LIVE_EVENT_REQUIRED')
  nonEmpty(input.subjectId,'SPORT_AUTO_LIVE_SUBJECT_REQUIRED')
  if(!Number.isInteger(input.sequence)||input.sequence<0)throw new Error('SPORT_AUTO_LIVE_SEQUENCE_INVALID')
  const observedAt=instant(input.observedAt,'SPORT_AUTO_LIVE_OBSERVED_AT_INVALID')
  const availableAt=instant(input.availableAt,'SPORT_AUTO_LIVE_AVAILABLE_AT_INVALID')
  const receivedAt=instant(input.receivedAt,'SPORT_AUTO_LIVE_RECEIVED_AT_INVALID')
  if(availableAt<observedAt)throw new Error('SPORT_AUTO_LIVE_AVAILABLE_BEFORE_OBSERVED')
  if(receivedAt<availableAt)throw new Error('SPORT_AUTO_LIVE_RECEIVED_BEFORE_AVAILABLE')
  if(typeof input.value==='number'&&!Number.isFinite(input.value))throw new Error('SPORT_AUTO_LIVE_NUMERIC_VALUE_INVALID')
  const evidenceIds=unique(input.evidenceIds)
  if(!evidenceIds.length)throw new Error('SPORT_AUTO_LIVE_EVIDENCE_REQUIRED')
  const observationId='sports-live-observation:'+hash({
    provider:input.provider,
    eventId:input.eventId,
    sequence:input.sequence,
    subjectId:input.subjectId,
    kind:input.kind,
    value:input.value,
    availableAt:input.availableAt,
  })
  const observation:SportsRealityObservation=Object.freeze({
    observationId,
    eventId:input.eventId,
    subjectId:input.subjectId,
    kind:input.kind,
    value:input.value,
    unit:input.unit,
    observedAt:input.observedAt,
    availableAt:input.availableAt,
    sourceType:'LIVE_'+input.sourceClass+':'+input.provider,
    sourceLocator:input.sourceLocator,
    evidenceIds,
    evidenceClass:input.sourceClass==='OFFICIAL'?'OFFICIAL_LIVE':'VERIFIED_CONTEXT',
    confidence:input.sourceClass==='OFFICIAL'?1:0.95,
    authority:'EVIDENCE_ONLY',
    canExecute:false,
  })
  return Object.freeze({
    updateId:'sports-live-update:'+hash({observationId,receivedAt:input.receivedAt}),
    provider:input.provider,
    sourceClass:input.sourceClass,
    sequence:input.sequence,
    eventId:input.eventId,
    eventStatus:input.eventStatus,
    observation,
    receivedAt:input.receivedAt,
    canonicalRealityEligible:input.sourceClass==='OFFICIAL'||input.sourceClass==='MANUAL_VERIFIED',
    authority:'LIVE_REALITY_EVIDENCE_ONLY',
    canAuthorizeBet:false,
    canExecute:false,
  })
}

export class SportsLiveRealityBus{
  private readonly lastSequence=new Map<string,number>()
  private readonly subscribers=new Set<SportsLiveRealitySubscriber>()
  private readonly updates:SportsLiveRealityUpdate[]=[]

  subscribe(subscriber:SportsLiveRealitySubscriber):()=>void{
    this.subscribers.add(subscriber)
    return()=>{this.subscribers.delete(subscriber)}
  }

  async publish(input:SportsLiveFeedObservation):Promise<SportsLiveRealityUpdate>{
    const key=input.provider+'|'+input.eventId
    const prior=this.lastSequence.get(key)
    if(prior!==undefined&&input.sequence<=prior)throw new Error('SPORT_AUTO_LIVE_SEQUENCE_REPLAY_OR_REGRESSION')
    const update=normalizeSportsLiveFeedObservation(input)
    this.lastSequence.set(key,input.sequence)
    this.updates.push(update)
    for(const subscriber of this.subscribers)await subscriber(update)
    return update
  }

  list(eventId?:string):readonly SportsLiveRealityUpdate[]{
    return Object.freeze(this.updates.filter(update=>eventId===undefined||update.eventId===eventId))
  }
}
