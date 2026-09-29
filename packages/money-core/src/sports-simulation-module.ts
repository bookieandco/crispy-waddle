import {createHash} from 'node:crypto'
import {summarizeSportsHistoricalMetrics,type SportsHistoricalSnapshot} from './sports-historical-warehouse.js'

export type SportsSimulationMetricWeight=Readonly<{
  metric:string
  weight:number
  higherIsBetter:boolean
}>

export type SportsSimulationModuleSpec=Readonly<{
  moduleId:string
  sport:string
  moduleVersion:string
  homeSubjectId:string
  awaySubjectId:string
  metricWeights:readonly SportsSimulationMetricWeight[]
  methodology:'WEIGHTED_RELATIVE_STRENGTH'
  authority:'SIMULATION_SPEC_ONLY'
  canExecute:false
}>

export type SportsHistoricalBaseOutcomeSet=Readonly<{
  baseOutcomeId:string
  moduleId:string
  moduleVersion:string
  sport:string
  outcomes:readonly Readonly<{outcomeId:string;probability:number}>[]
  homeStrength:number
  awayStrength:number
  evidenceIds:readonly string[]
  authority:'SIMULATION_INPUT_ONLY'
  canExecute:false
}>

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())
const sigmoid=(value:number):number=>1/(1+Math.exp(-value))

export function deriveHistoricalBaseOutcomes(input:{
  snapshot:SportsHistoricalSnapshot
  module:SportsSimulationModuleSpec
  recentSampleSize?:number
}):SportsHistoricalBaseOutcomeSet{
  const module=input.module
  if(module.authority!=='SIMULATION_SPEC_ONLY'||module.canExecute!==false)throw new Error('SPORT_AUTO_SIM_MODULE_AUTHORITY_INVALID')
  if(!module.moduleId.trim()||!module.moduleVersion.trim()||!module.sport.trim())throw new Error('SPORT_AUTO_SIM_MODULE_IDENTITY_REQUIRED')
  if(module.sport!==input.snapshot.query.sport)throw new Error('SPORT_AUTO_SIM_MODULE_SPORT_MISMATCH')
  if(module.homeSubjectId===module.awaySubjectId)throw new Error('SPORT_AUTO_SIM_MODULE_SUBJECTS_MUST_DIFFER')
  if(!module.metricWeights.length)throw new Error('SPORT_AUTO_SIM_MODULE_METRICS_REQUIRED')
  for(const metric of module.metricWeights){
    if(!metric.metric.trim()||!Number.isFinite(metric.weight)||metric.weight<=0)throw new Error('SPORT_AUTO_SIM_MODULE_WEIGHT_INVALID')
  }
  const summaries=summarizeSportsHistoricalMetrics({snapshot:input.snapshot,recentSampleSize:input.recentSampleSize})
  const byKey=new Map(summaries.map(summary=>[summary.subjectId+'|'+summary.metric,summary] as const))
  let homeStrength=0
  let awayStrength=0
  let weightTotal=0
  const evidenceIds:string[]=[]
  for(const config of module.metricWeights){
    const home=byKey.get(module.homeSubjectId+'|'+config.metric)
    const away=byKey.get(module.awaySubjectId+'|'+config.metric)
    if(!home||!away)continue
    const scale=Math.max(Math.abs(home.recentMean),Math.abs(away.recentMean),1)
    const direction=config.higherIsBetter?1:-1
    homeStrength+=direction*(home.recentMean/scale)*config.weight
    awayStrength+=direction*(away.recentMean/scale)*config.weight
    weightTotal+=config.weight
    evidenceIds.push(...home.evidenceIds,...away.evidenceIds)
  }
  if(weightTotal<=0)throw new Error('SPORT_AUTO_SIM_MODULE_NO_COMPARABLE_HISTORY')
  homeStrength/=weightTotal
  awayStrength/=weightTotal
  const homeProbability=sigmoid((homeStrength-awayStrength)*2)
  const awayProbability=1-homeProbability
  const outcomes=Object.freeze([
    Object.freeze({outcomeId:'HOME',probability:homeProbability}),
    Object.freeze({outcomeId:'AWAY',probability:awayProbability}),
  ])
  return Object.freeze({
    baseOutcomeId:'sports-history-base:'+hash({snapshotId:input.snapshot.snapshotId,moduleId:module.moduleId,moduleVersion:module.moduleVersion,outcomes}),
    moduleId:module.moduleId,
    moduleVersion:module.moduleVersion,
    sport:module.sport,
    outcomes,
    homeStrength,
    awayStrength,
    evidenceIds:unique(evidenceIds),
    authority:'SIMULATION_INPUT_ONLY',
    canExecute:false,
  })
}

export class SportsSimulationModuleRegistry{
  private readonly modules=new Map<string,SportsSimulationModuleSpec>()

  register(module:SportsSimulationModuleSpec):void{
    if(this.modules.has(module.moduleId))throw new Error('SPORT_AUTO_SIM_MODULE_DUPLICATE')
    if(module.authority!=='SIMULATION_SPEC_ONLY'||module.canExecute!==false)throw new Error('SPORT_AUTO_SIM_MODULE_AUTHORITY_INVALID')
    this.modules.set(module.moduleId,Object.freeze({...module,metricWeights:Object.freeze([...module.metricWeights])}))
  }

  get(moduleId:string):SportsSimulationModuleSpec{
    const module=this.modules.get(moduleId)
    if(!module)throw new Error('SPORT_AUTO_SIM_MODULE_NOT_FOUND')
    return module
  }

  list():readonly SportsSimulationModuleSpec[]{return Object.freeze([...this.modules.values()].sort((a,b)=>a.moduleId.localeCompare(b.moduleId)))}
}
