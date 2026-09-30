import { createHash } from 'node:crypto'
import type { SportsScenarioSliderName } from './sports-prediction-simulation.js'

export type SportsSliderEvidenceClass='REAL_AS_OF'|'SYNTHETIC_TEST'
export type SportsSliderResolutionMode='LEARNED'|'STRESS_OVERRIDE'

export type SportsSliderSignal=Readonly<{
  slider:SportsScenarioSliderName
  observedValue:number
  learnedBaseline:number
  observedWeightBps:number
  evidenceStrengthBps:number
  overrideValue?:number
  evidenceIds:readonly string[]
}>

export type SportsSliderImpactRule=Readonly<{
  ruleId:string
  sport:string
  marketFamily:string
  slider:SportsScenarioSliderName
  ruleVersion:string
  outcomeLogitImpactBps:Readonly<Record<string,number>>
  volatilityImpactBps:number
  sourceClass:SportsSliderEvidenceClass
  sampleSize:number
  evidenceIds:readonly string[]
}>

export type ResolvedSportsSlider=Readonly<{
  slider:SportsScenarioSliderName
  observedValue:number
  learnedBaseline:number
  effectiveValue:number
  mode:SportsSliderResolutionMode
  evidenceStrengthBps:number
  evidenceIds:readonly string[]
}>

export type SportsSliderImpactAssessment=Readonly<{
  assessmentId:string
  sport:string
  marketFamily:string
  ruleVersionSet:readonly string[]
  sliders:readonly ResolvedSportsSlider[]
  outcomeLogitShiftBps:Readonly<Record<string,number>>
  volatilityBps:number
  realRuleCount:number
  syntheticRuleCount:number
  calibrationEligible:boolean
  evidenceIds:readonly string[]
  authority:'SIMULATION_INPUT_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const bps=(v:number,c:string)=>{if(!Number.isInteger(v)||v<0||v>10000)throw new Error(c)}
const signedUnit=(v:number,c:string)=>{if(!Number.isFinite(v)||v<-1||v>1)throw new Error(c)}
const unique=<T extends string>(xs:readonly T[])=>Object.freeze([...new Set(xs)].sort()) as readonly T[]

export function resolveSportsSlider(signal:SportsSliderSignal):ResolvedSportsSlider{
  signedUnit(signal.observedValue,'SPORT_SIM_SLIDER_OBSERVED_INVALID')
  signedUnit(signal.learnedBaseline,'SPORT_SIM_SLIDER_BASELINE_INVALID')
  bps(signal.observedWeightBps,'SPORT_SIM_SLIDER_WEIGHT_INVALID')
  bps(signal.evidenceStrengthBps,'SPORT_SIM_SLIDER_EVIDENCE_STRENGTH_INVALID')
  if(signal.overrideValue!==undefined)signedUnit(signal.overrideValue,'SPORT_SIM_SLIDER_OVERRIDE_INVALID')
  if(!signal.evidenceIds.length)throw new Error('SPORT_SIM_SLIDER_EVIDENCE_REQUIRED')
  const learnedWeight=10000-signal.observedWeightBps
  const evidenceScaledObserved=signal.observedValue*(signal.evidenceStrengthBps/10000)
  const learned=(evidenceScaledObserved*signal.observedWeightBps+signal.learnedBaseline*learnedWeight)/10000
  const mode:SportsSliderResolutionMode=signal.overrideValue===undefined?'LEARNED':'STRESS_OVERRIDE'
  const effectiveValue=clamp(signal.overrideValue??learned,-1,1)
  return Object.freeze({
    slider:signal.slider,
    observedValue:signal.observedValue,
    learnedBaseline:signal.learnedBaseline,
    effectiveValue,
    mode,
    evidenceStrengthBps:signal.evidenceStrengthBps,
    evidenceIds:unique(signal.evidenceIds),
  })
}

export function assessSportsSliderImpacts(input:{
  sport:string
  marketFamily:string
  signals:readonly SportsSliderSignal[]
  rules:readonly SportsSliderImpactRule[]
  baseVolatilityBps:number
}):SportsSliderImpactAssessment{
  if(!input.sport.trim()||!input.marketFamily.trim())throw new Error('SPORT_SIM_SLIDER_SCOPE_REQUIRED')
  bps(input.baseVolatilityBps,'SPORT_SIM_BASE_VOLATILITY_INVALID')
  const resolved=input.signals.map(resolveSportsSlider)
  const signalNames=new Set(resolved.map(x=>x.slider))
  if(signalNames.size!==resolved.length)throw new Error('SPORT_SIM_DUPLICATE_SLIDER_SIGNAL')
  const applicable=input.rules.filter(r=>r.sport===input.sport&&r.marketFamily===input.marketFamily&&signalNames.has(r.slider))
  const seen=new Set<string>()
  for(const r of applicable){
    if(seen.has(r.ruleId))throw new Error('SPORT_SIM_DUPLICATE_SLIDER_RULE')
    seen.add(r.ruleId)
    if(!r.ruleId.trim()||!r.ruleVersion.trim()||!r.evidenceIds.length)throw new Error('SPORT_SIM_SLIDER_RULE_LINEAGE_REQUIRED')
    if(!Number.isInteger(r.volatilityImpactBps)||Math.abs(r.volatilityImpactBps)>10000)throw new Error('SPORT_SIM_SLIDER_RULE_VOLATILITY_INVALID')
    if(!Number.isInteger(r.sampleSize)||r.sampleSize<0)throw new Error('SPORT_SIM_SLIDER_RULE_SAMPLE_INVALID')
    for(const v of Object.values(r.outcomeLogitImpactBps)){
      if(!Number.isInteger(v)||Math.abs(v)>20000)throw new Error('SPORT_SIM_SLIDER_RULE_IMPACT_INVALID')
    }
  }
  const shifts:Record<string,number>={}
  let volatility=input.baseVolatilityBps
  for(const s of resolved){
    const rules=applicable.filter(r=>r.slider===s.slider)
    for(const r of rules){
      for(const [outcome,impact] of Object.entries(r.outcomeLogitImpactBps)){
        shifts[outcome]=(shifts[outcome]??0)+Math.round(impact*s.effectiveValue)
      }
      volatility+=Math.round(r.volatilityImpactBps*Math.abs(s.effectiveValue))
    }
  }
  const realRuleCount=applicable.filter(r=>r.sourceClass==='REAL_AS_OF').length
  const syntheticRuleCount=applicable.length-realRuleCount
  const evidenceIds=unique([
    ...resolved.flatMap(s=>s.evidenceIds),
    ...applicable.flatMap(r=>r.evidenceIds),
  ])
  return Object.freeze({
    assessmentId:'sport-slider-impact:'+hash({sport:input.sport,marketFamily:input.marketFamily,resolved,rules:applicable.map(r=>r.ruleId),baseVolatilityBps:input.baseVolatilityBps}),
    sport:input.sport,
    marketFamily:input.marketFamily,
    ruleVersionSet:unique(applicable.map(r=>r.ruleVersion)),
    sliders:Object.freeze(resolved),
    outcomeLogitShiftBps:Object.freeze(shifts),
    volatilityBps:clamp(volatility,0,10000),
    realRuleCount,
    syntheticRuleCount,
    calibrationEligible:applicable.length>0&&syntheticRuleCount===0&&resolved.every(s=>s.mode==='LEARNED'),
    evidenceIds,
    authority:'SIMULATION_INPUT_ONLY',
    canExecute:false,
  })
}
