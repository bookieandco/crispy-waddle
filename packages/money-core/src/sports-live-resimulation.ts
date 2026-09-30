import { createHash } from 'node:crypto'
import type { SportsSimState } from './sports-simulation-state.js'
import type { CorrelatedSportsSimulation } from './sports-correlated-monte-carlo.js'
import type { ResolvedSportsSlider } from './sports-simulation-slider-engine.js'

export type SportsLiveTrigger=
  |'SCORE_CHANGE'|'CLOCK_CHANGE'|'POSSESSION_CHANGE'|'LINEUP_CHANGE'|'INJURY_CHANGE'
  |'WEATHER_CHANGE'|'ROLE_CHANGE'|'MARKET_MOVE'|'CARD_OR_FOUL_CHANGE'|'MANUAL_STRESS_TEST'|'OTHER'

export type SportsLiveProbabilityDelta=Readonly<{
  legId:string
  priorProbability:number
  nextProbability:number
  deltaBps:number
}>

export type SportsLiveJointDelta=Readonly<{
  jointId:string
  priorProbability:number
  nextProbability:number
  deltaBps:number
}>

export type SportsLiveDriverAttribution=Readonly<{
  driverId:string
  kind:'STATE'|'SLIDER'|'EVIDENCE'
  description:string
  direction:'UP'|'DOWN'|'MIXED'|'UNKNOWN'
  magnitudeBps:number
  evidenceIds:readonly string[]
}>

export type SportsLiveResimulation=Readonly<{
  revisionId:string
  eventId:string
  sport:string
  triggers:readonly SportsLiveTrigger[]
  priorSimulationId:string
  nextSimulationId:string
  priorStateHash:string
  nextStateHash:string
  marketDeltas:readonly SportsLiveProbabilityDelta[]
  jointDeltas:readonly SportsLiveJointDelta[]
  driverAttribution:readonly SportsLiveDriverAttribution[]
  changedSliderNames:readonly string[]
  changedEvidenceIds:readonly string[]
  observedAt:string
  authority:'INTELLIGENCE_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=<T extends string>(xs:readonly T[])=>Object.freeze([...new Set(xs)].sort()) as readonly T[]
const probMap=(xs:readonly {legId:string;probability:number}[])=>new Map(xs.map(x=>[x.legId,x.probability]))
const jointMap=(xs:readonly {jointId:string;probability:number}[])=>new Map(xs.map(x=>[x.jointId,x.probability]))

export function stateFingerprint(state:SportsSimState):string{
  return hash(state)
}

export function createSportsLiveResimulation(input:{
  priorState:SportsSimState
  nextState:SportsSimState
  priorSimulation:CorrelatedSportsSimulation
  nextSimulation:CorrelatedSportsSimulation
  priorSliders?:readonly ResolvedSportsSlider[]
  nextSliders?:readonly ResolvedSportsSlider[]
  triggers:readonly SportsLiveTrigger[]
  changedEvidenceIds:readonly string[]
  observedAt:string
}):SportsLiveResimulation{
  if(input.priorState.sport!==input.nextState.sport||input.priorSimulation.sport!==input.nextSimulation.sport||input.priorState.sport!==input.priorSimulation.sport)throw new Error('SPORT_SIM_LIVE_SPORT_MISMATCH')
  if(input.priorSimulation.eventId!==input.nextSimulation.eventId)throw new Error('SPORT_SIM_LIVE_EVENT_MISMATCH')
  if(!input.triggers.length||!input.changedEvidenceIds.length)throw new Error('SPORT_SIM_LIVE_LINEAGE_REQUIRED')
  if(Number.isNaN(Date.parse(input.observedAt)))throw new Error('SPORT_SIM_LIVE_TIME_INVALID')
  const priorMarket=probMap(input.priorSimulation.marketProbabilities),nextMarket=probMap(input.nextSimulation.marketProbabilities)
  const legIds=unique([...priorMarket.keys(),...nextMarket.keys()])
  const marketDeltas=legIds.map(legId=>{
    const prior=priorMarket.get(legId)
    const next=nextMarket.get(legId)
    if(prior===undefined||next===undefined)throw new Error('SPORT_SIM_LIVE_MARKET_SET_CHANGED')
    return Object.freeze({legId,priorProbability:prior,nextProbability:next,deltaBps:Math.round((next-prior)*10000)})
  })
  const priorJoint=jointMap(input.priorSimulation.jointProbabilities),nextJoint=jointMap(input.nextSimulation.jointProbabilities)
  const jointIds=unique([...priorJoint.keys(),...nextJoint.keys()])
  const jointDeltas=jointIds.map(jointId=>{
    const prior=priorJoint.get(jointId)
    const next=nextJoint.get(jointId)
    if(prior===undefined||next===undefined)throw new Error('SPORT_SIM_LIVE_JOINT_SET_CHANGED')
    return Object.freeze({jointId,priorProbability:prior,nextProbability:next,deltaBps:Math.round((next-prior)*10000)})
  })

  const priorSliderMap=new Map((input.priorSliders??[]).map(s=>[s.slider,s]))
  const nextSliderMap=new Map((input.nextSliders??[]).map(s=>[s.slider,s]))
  const changedSliderNames=unique([...nextSliderMap.keys()].filter(name=>{
    const a=priorSliderMap.get(name),b=nextSliderMap.get(name)
    return !a||!b||a.effectiveValue!==b.effectiveValue
  }))
  const drivers:SportsLiveDriverAttribution[]=[]
  if(stateFingerprint(input.priorState)!==stateFingerprint(input.nextState)){
    const largest=Math.max(0,...marketDeltas.map(d=>Math.abs(d.deltaBps)))
    drivers.push(Object.freeze({driverId:'state-change',kind:'STATE',description:'Live game state changed.',direction:'MIXED',magnitudeBps:largest,evidenceIds:unique(input.changedEvidenceIds)}))
  }
  for(const name of changedSliderNames){
    const a=priorSliderMap.get(name)?.effectiveValue??0,b=nextSliderMap.get(name)?.effectiveValue??0
    drivers.push(Object.freeze({
      driverId:'slider:'+name,
      kind:'SLIDER',
      description:name+' changed from '+a.toFixed(3)+' to '+b.toFixed(3)+'.',
      direction:b>a?'UP':b<a?'DOWN':'UNKNOWN',
      magnitudeBps:Math.round(Math.abs(b-a)*10000),
      evidenceIds:unique([...(nextSliderMap.get(name)?.evidenceIds??[]),...input.changedEvidenceIds]),
    }))
  }
  return Object.freeze({
    revisionId:'sport-live-resim:'+hash({prior:input.priorSimulation.simulationId,next:input.nextSimulation.simulationId,triggers:[...input.triggers].sort(),observedAt:input.observedAt}),
    eventId:input.nextSimulation.eventId,
    sport:input.nextSimulation.sport,
    triggers:unique(input.triggers),
    priorSimulationId:input.priorSimulation.simulationId,
    nextSimulationId:input.nextSimulation.simulationId,
    priorStateHash:stateFingerprint(input.priorState),
    nextStateHash:stateFingerprint(input.nextState),
    marketDeltas:Object.freeze(marketDeltas),
    jointDeltas:Object.freeze(jointDeltas),
    driverAttribution:Object.freeze(drivers),
    changedSliderNames,
    changedEvidenceIds:unique(input.changedEvidenceIds),
    observedAt:input.observedAt,
    authority:'INTELLIGENCE_ONLY',
    bettingAuthority:'NONE',
    financialAuthority:'NONE',
    canExecute:false,
  })
}
