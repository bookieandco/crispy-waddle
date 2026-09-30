import { createHash } from 'node:crypto'

export type SportsSimulationCalibrationSource='REAL_AS_OF'|'SYNTHETIC_TEST'
export type SportsSimulationProbabilityObservation=Readonly<{
  observationId:string
  sport:string
  marketFamily:string
  modelVersion:string
  probability:number
  actual:0|1
  issuedAt:string
  resolvedAt:string
  sourceClass:SportsSimulationCalibrationSource
  evidenceIds:readonly string[]
  kind:'MARKET'|'TAIL'|'JOINT'
}>

export type SportsSimulationCalibrationReport=Readonly<{
  reportId:string
  sport:string
  marketFamily:string
  modelVersion:string
  kind:'MARKET'|'TAIL'|'JOINT'
  sampleSize:number
  realSampleSize:number
  brierScore:number|null
  logLoss:number|null
  expectedCalibrationError:number|null
  status:'SOFTWARE_ONLY'|'INSUFFICIENT_REAL_EVIDENCE'|'CALIBRATED'
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

export type SportsSliderAblation=Readonly<{
  ablationId:string
  slider:string
  sport:string
  marketFamily:string
  baselineMetric:number
  metricWithoutSlider:number
  incrementalValue:number
  sourceClass:SportsSimulationCalibrationSource
  sampleSize:number
  evidenceIds:readonly string[]
  status:'HELPFUL'|'NEUTRAL'|'HARMFUL'|'SOFTWARE_ONLY'
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

export type SportsSliderSensitivity=Readonly<{
  sensitivityId:string
  slider:string
  lowValue:number
  highValue:number
  lowProbability:number
  highProbability:number
  probabilityDeltaBps:number
  monotonicDirection:'UP'|'DOWN'|'FLAT'
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const mean=(xs:readonly number[])=>xs.reduce((a,b)=>a+b,0)/xs.length
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))

function ece(xs:readonly SportsSimulationProbabilityObservation[]):number{
  const buckets=Array.from({length:10},()=>[] as SportsSimulationProbabilityObservation[])
  for(const x of xs)buckets[Math.min(9,Math.floor(x.probability*10))]!.push(x)
  let result=0
  for(const b of buckets){
    if(!b.length)continue
    const p=mean(b.map(x=>x.probability)),a=mean(b.map(x=>x.actual))
    result+=b.length/xs.length*Math.abs(p-a)
  }
  return result
}

export function assessSportsSimulationCalibration(input:{
  observations:readonly SportsSimulationProbabilityObservation[]
  minimumRealSamples:number
}):readonly SportsSimulationCalibrationReport[]{
  if(!Number.isInteger(input.minimumRealSamples)||input.minimumRealSamples<2)throw new Error('SPORT_SIM_CALIBRATION_MIN_SAMPLE_INVALID')
  const groups=new Map<string,SportsSimulationProbabilityObservation[]>()
  for(const o of input.observations){
    if(!o.observationId.trim()||!o.evidenceIds.length)throw new Error('SPORT_SIM_CALIBRATION_LINEAGE_REQUIRED')
    if(!Number.isFinite(o.probability)||o.probability<=0||o.probability>=1)throw new Error('SPORT_SIM_CALIBRATION_PROBABILITY_INVALID')
    if(Date.parse(o.resolvedAt)<=Date.parse(o.issuedAt))throw new Error('SPORT_SIM_CALIBRATION_CLOCK_INVALID')
    const key=[o.sport,o.marketFamily,o.modelVersion,o.kind].join('|')
    const g=groups.get(key)??[];g.push(o);groups.set(key,g)
  }
  const reports:SportsSimulationCalibrationReport[]=[]
  for(const xs of groups.values()){
    const first=xs[0]!,real=xs.filter(x=>x.sourceClass==='REAL_AS_OF')
    const brier=real.length?mean(real.map(x=>(x.probability-x.actual)**2)):null
    const logLoss=real.length?mean(real.map(x=>-(x.actual*Math.log(clamp(x.probability,1e-12,1-1e-12))+(1-x.actual)*Math.log(clamp(1-x.probability,1e-12,1-1e-12))))):null
    const status:SportsSimulationCalibrationReport['status']=real.length===0?'SOFTWARE_ONLY':real.length<input.minimumRealSamples?'INSUFFICIENT_REAL_EVIDENCE':'CALIBRATED'
    reports.push(Object.freeze({
      reportId:'sport-sim-calibration:'+hash({key:[first.sport,first.marketFamily,first.modelVersion,first.kind],ids:xs.map(x=>x.observationId).sort()}),
      sport:first.sport,marketFamily:first.marketFamily,modelVersion:first.modelVersion,kind:first.kind,
      sampleSize:xs.length,realSampleSize:real.length,brierScore:brier,logLoss,expectedCalibrationError:real.length?ece(real):null,
      status,evidenceIds:unique(xs.flatMap(x=>x.evidenceIds)),authority:'LEARNING_ONLY',canAuthorizeLive:false,
    }))
  }
  return Object.freeze(reports)
}

export function assessSportsSliderAblation(input:{
  slider:string
  sport:string
  marketFamily:string
  baselineMetric:number
  metricWithoutSlider:number
  sourceClass:SportsSimulationCalibrationSource
  sampleSize:number
  evidenceIds:readonly string[]
}):SportsSliderAblation{
  if(!input.slider.trim()||!input.sport.trim()||!input.marketFamily.trim()||!input.evidenceIds.length)throw new Error('SPORT_SIM_ABLATION_LINEAGE_REQUIRED')
  if(!Number.isFinite(input.baselineMetric)||!Number.isFinite(input.metricWithoutSlider)||input.baselineMetric<0||input.metricWithoutSlider<0)throw new Error('SPORT_SIM_ABLATION_METRIC_INVALID')
  if(!Number.isInteger(input.sampleSize)||input.sampleSize<1)throw new Error('SPORT_SIM_ABLATION_SAMPLE_INVALID')
  const incrementalValue=input.metricWithoutSlider-input.baselineMetric
  const status:SportsSliderAblation['status']=input.sourceClass==='SYNTHETIC_TEST'?'SOFTWARE_ONLY':Math.abs(incrementalValue)<1e-6?'NEUTRAL':incrementalValue>0?'HELPFUL':'HARMFUL'
  return Object.freeze({
    ablationId:'sport-sim-ablation:'+hash(input),slider:input.slider,sport:input.sport,marketFamily:input.marketFamily,
    baselineMetric:input.baselineMetric,metricWithoutSlider:input.metricWithoutSlider,incrementalValue,
    sourceClass:input.sourceClass,sampleSize:input.sampleSize,evidenceIds:unique(input.evidenceIds),
    status,authority:'LEARNING_ONLY',canAuthorizeLive:false,
  })
}

export function assessSportsSliderSensitivity(input:{
  slider:string
  lowValue:number
  highValue:number
  lowProbability:number
  highProbability:number
  evidenceIds:readonly string[]
}):SportsSliderSensitivity{
  if(!input.slider.trim()||!input.evidenceIds.length)throw new Error('SPORT_SIM_SENSITIVITY_LINEAGE_REQUIRED')
  for(const v of [input.lowValue,input.highValue])if(!Number.isFinite(v)||v<-1||v>1)throw new Error('SPORT_SIM_SENSITIVITY_SLIDER_INVALID')
  for(const p of [input.lowProbability,input.highProbability])if(!Number.isFinite(p)||p<0||p>1)throw new Error('SPORT_SIM_SENSITIVITY_PROBABILITY_INVALID')
  if(input.highValue<=input.lowValue)throw new Error('SPORT_SIM_SENSITIVITY_RANGE_INVALID')
  const delta=Math.round((input.highProbability-input.lowProbability)*10000)
  return Object.freeze({
    sensitivityId:'sport-sim-sensitivity:'+hash(input),slider:input.slider,lowValue:input.lowValue,highValue:input.highValue,
    lowProbability:input.lowProbability,highProbability:input.highProbability,probabilityDeltaBps:delta,
    monotonicDirection:delta>0?'UP':delta<0?'DOWN':'FLAT',evidenceIds:unique(input.evidenceIds),
    authority:'LEARNING_ONLY',canAuthorizeLive:false,
  })
}
