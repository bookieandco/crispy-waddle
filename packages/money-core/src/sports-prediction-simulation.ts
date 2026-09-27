import { createHash } from 'node:crypto'
import type { SportsPredictionFeatureSnapshot } from './sports-prediction-features.js'

export type SportsScenarioSliderName=
  |'FORM'|'MATCHUP'|'HOT_STREAK'|'FATIGUE'|'INJURY_UNCERTAINTY'|'PACE'
  |'VENUE'|'WEATHER'|'PLAYER_NIGHT'|'TACTICAL_ADJUSTMENT'|'OTHER'

export type SportsScenarioSlider=Readonly<{
  name:SportsScenarioSliderName
  value:number
  rationale:string
  evidenceIds:readonly string[]
}>

export type SportsPredictionScenario=Readonly<{
  scenarioId:string
  label:string
  outcomeLogitShiftBps:Readonly<Record<string,number>>
  volatilityBps:number
  sliders:readonly SportsScenarioSlider[]
  authority:'SIMULATION_INPUT_ONLY'
  canExecute:false
}>

export type SportsSimulationOutcome=Readonly<{
  outcomeId:string
  probability:number
  pathStdDev:number
}>

export type SportsPredictionSimulation=Readonly<{
  simulationId:string
  eventId:string
  modelId:string
  modelVersion:string
  featureSnapshotId:string
  scenarioId:string
  randomSeed:string
  pathCount:number
  outcomes:readonly SportsSimulationOutcome[]
  aleatoricUncertainty:number
  epistemicUncertainty:number
  overallUncertainty:number
  inputHash:string
  provenanceHash:string
  authority:'SIMULATION_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

function seed32(seed:string):number{
  const h=createHash('sha256').update(seed).digest()
  return h.readUInt32LE(0)||1
}
function prng(seed:string):()=>number{
  let x=seed32(seed)
  return()=>{
    x^=x<<13;x^=x>>>17;x^=x<<5
    return (x>>>0)/4294967296
  }
}
function centeredNoise(next:()=>number):number{
  let s=0
  for(let i=0;i<6;i++)s+=next()
  return s-3
}
function normalize(xs:readonly number[]):number[]{
  const total=xs.reduce((a,b)=>a+b,0)
  if(!Number.isFinite(total)||total<=0)throw new Error('SPORT_PRED_SIMULATION_NORMALIZATION_FAILED')
  return xs.map(x=>x/total)
}
function assertProbabilityMass(outcomes:readonly {outcomeId:string;probability:number}[]):void{
  if(outcomes.length<2)throw new Error('SPORT_PRED_SIMULATION_OUTCOMES_INSUFFICIENT')
  const ids=new Set<string>()
  let total=0
  for(const o of outcomes){
    if(!o.outcomeId.trim())throw new Error('SPORT_PRED_SIMULATION_OUTCOME_ID_REQUIRED')
    if(ids.has(o.outcomeId))throw new Error('SPORT_PRED_SIMULATION_DUPLICATE_OUTCOME')
    ids.add(o.outcomeId)
    if(!Number.isFinite(o.probability)||o.probability<=0||o.probability>=1)throw new Error('SPORT_PRED_SIMULATION_BASE_PROBABILITY_INVALID')
    total+=o.probability
  }
  if(Math.abs(total-1)>1e-6)throw new Error('SPORT_PRED_SIMULATION_BASE_MASS_INVALID')
}

export function runSportsPredictionSimulation(input:{
  eventId:string
  featureSnapshot:SportsPredictionFeatureSnapshot
  modelId:string
  modelVersion:string
  baseOutcomes:readonly {outcomeId:string;probability:number}[]
  scenario:SportsPredictionScenario
  randomSeed:string
  pathCount:number
}):SportsPredictionSimulation{
  if(input.featureSnapshot.eventId!==input.eventId)throw new Error('SPORT_PRED_SIMULATION_EVENT_MISMATCH')
  if(input.featureSnapshot.authority!=='MODEL_INPUT_ONLY'||input.featureSnapshot.canExecute!==false)throw new Error('SPORT_PRED_SIMULATION_FEATURE_AUTHORITY_INVALID')
  if(!input.modelId.trim()||!input.modelVersion.trim()||!input.randomSeed.trim())throw new Error('SPORT_PRED_SIMULATION_IDENTITY_REQUIRED')
  if(!Number.isInteger(input.pathCount)||input.pathCount<100)throw new Error('SPORT_PRED_SIMULATION_PATH_COUNT_TOO_LOW')
  assertProbabilityMass(input.baseOutcomes)
  if(!Number.isInteger(input.scenario.volatilityBps)||input.scenario.volatilityBps<0||input.scenario.volatilityBps>10000)throw new Error('SPORT_PRED_SIMULATION_VOLATILITY_INVALID')
  if(input.scenario.authority!=='SIMULATION_INPUT_ONLY'||input.scenario.canExecute!==false)throw new Error('SPORT_PRED_SIMULATION_SCENARIO_AUTHORITY_INVALID')
  for(const s of input.scenario.sliders){
    if(!Number.isFinite(s.value)||s.value<-1||s.value>1||!s.rationale.trim()||!s.evidenceIds.length)throw new Error('SPORT_PRED_SIMULATION_SLIDER_INVALID')
  }
  const ids=input.baseOutcomes.map(o=>o.outcomeId)
  for(const key of Object.keys(input.scenario.outcomeLogitShiftBps)){
    if(!ids.includes(key))throw new Error('SPORT_PRED_SIMULATION_SHIFT_UNKNOWN_OUTCOME')
    const shift=input.scenario.outcomeLogitShiftBps[key]
    if(shift===undefined||!Number.isFinite(shift)||Math.abs(shift)>20000)throw new Error('SPORT_PRED_SIMULATION_SHIFT_INVALID')
  }

  const next=prng(input.randomSeed)
  const sums=new Array<number>(ids.length).fill(0)
  const sumSquares=new Array<number>(ids.length).fill(0)
  let entropySum=0
  const volatility=input.scenario.volatilityBps/10000
  for(let path=0;path<input.pathCount;path++){
    const weights=input.baseOutcomes.map(o=>{
      const shift=(input.scenario.outcomeLogitShiftBps[o.outcomeId]??0)/10000
      const noise=centeredNoise(next)*volatility
      return Math.exp(Math.log(o.probability)+shift+noise)
    })
    const probs=normalize(weights)
    let entropy=0
    for(let i=0;i<probs.length;i++){
      const p=probs[i]!
      sums[i]+=p
      sumSquares[i]+=p*p
      entropy-=p*Math.log(p)
    }
    entropySum+=entropy/Math.log(probs.length)
  }

  const outcomes=ids.map((outcomeId,i)=>{
    const mean=sums[i]!/input.pathCount
    const variance=Math.max(0,sumSquares[i]!/input.pathCount-mean*mean)
    return Object.freeze({outcomeId,probability:mean,pathStdDev:Math.sqrt(variance)})
  })
  const maxStd=Math.max(...outcomes.map(o=>o.pathStdDev))
  const aleatoricUncertainty=clamp(entropySum/input.pathCount,0,1)
  const epistemicUncertainty=clamp(maxStd*4,0,1)
  const overallUncertainty=clamp((aleatoricUncertainty+epistemicUncertainty)/2,0,1)
  const inputHash=hash({
    eventId:input.eventId,
    featureSnapshotId:input.featureSnapshot.featureSnapshotId,
    model:[input.modelId,input.modelVersion],
    base:input.baseOutcomes,
    scenario:input.scenario,
    randomSeed:input.randomSeed,
    pathCount:input.pathCount,
  })
  const provenanceHash=hash({
    inputHash,
    featureSnapshotHash:input.featureSnapshot.featureSnapshotHash,
    sliderEvidence:unique(input.scenario.sliders.flatMap(s=>s.evidenceIds)),
  })
  return Object.freeze({
    simulationId:'sport-sim:'+provenanceHash,
    eventId:input.eventId,
    modelId:input.modelId,
    modelVersion:input.modelVersion,
    featureSnapshotId:input.featureSnapshot.featureSnapshotId,
    scenarioId:input.scenario.scenarioId,
    randomSeed:input.randomSeed,
    pathCount:input.pathCount,
    outcomes:Object.freeze(outcomes),
    aleatoricUncertainty,
    epistemicUncertainty,
    overallUncertainty,
    inputHash,
    provenanceHash,
    authority:'SIMULATION_ONLY',
    canExecute:false,
  })
}
