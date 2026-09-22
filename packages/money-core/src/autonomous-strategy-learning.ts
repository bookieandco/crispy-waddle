import { createHash } from 'node:crypto'
import type { PaperStrategyResult } from './paper-strategy-result.js'

export type AutonomousLearningDomain='STOCK'|'FOREX'|'MEME'|'CRYPTO'|'SPORTS_BETTING'|'PREDICTION_MARKET'

export type StrategyLearningRecord=Readonly<{
  learningRecordId:string
  domain:AutonomousLearningDomain
  strategyId:string
  scenarioId:string
  paperRunId:string
  strategyResultId:string
  returnBps:number
  fillRateBps:number
  slippageBps:number
  feesPaidMinor:string
  outcomeScore:number
  executionQuality:number
  evidenceIds:readonly string[]
  evaluatedAt:string
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

export type StrategyCalibration=Readonly<{
  calibrationId:string
  domain:AutonomousLearningDomain
  strategyId:string
  sampleSize:number
  meanReturnBps:number
  downsideRateBps:number
  meanFillRateBps:number
  meanAbsSlippageBps:number
  meanOutcomeScore:number
  evidenceStrength:number
  status:'INSUFFICIENT_EVIDENCE'|'SIMULATION_SUPPORTED'|'SIMULATION_MIXED'|'SIMULATION_REJECTED'
  recommendedConfidenceBps:number|null
  learningRecordIds:readonly string[]
  calibratedAt:string
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

export type StrategyPromotionAssessment=Readonly<{
  assessmentId:string
  calibrationId:string
  status:'INSUFFICIENT_DATA'|'ELIGIBLE_FOR_AUTONOMOUS_REVIEW'|'REJECTED'
  reasonCodes:readonly string[]
  authority:'REVIEW_ONLY'
  canAuthorizeLive:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))

export function learnFromPaperStrategy(input:{domain:AutonomousLearningDomain;strategyId:string;scenarioId:string;result:PaperStrategyResult}):StrategyLearningRecord{
  const {result:r}=input
  if(r.authority!=='LEARNING_ONLY'||r.terminalState!=='CLOSED')throw new Error('MONEY_AUTO_LEARNING_REQUIRES_CLOSED_PAPER_RESULT')
  if(!input.strategyId.trim()||!input.scenarioId.trim()||!r.evidenceIds.length)throw new Error('MONEY_AUTO_LEARNING_PROVENANCE_REQUIRED')
  if(!Number.isInteger(r.aggregateFillRateBps)||r.aggregateFillRateBps<0||r.aggregateFillRateBps>10000)throw new Error('MONEY_AUTO_LEARNING_FILL_RATE_INVALID')
  const executionQuality=clamp((r.aggregateFillRateBps/10000)*(1-Math.min(10000,Math.abs(r.weightedSlippageBps))/10000),0,1)
  const outcomeScore=clamp(r.returnBps/10000,-1,1)
  return Object.freeze({
    learningRecordId:'auto-learning:'+hash({domain:input.domain,strategyId:input.strategyId,scenarioId:input.scenarioId,result:r.strategyResultId}),
    domain:input.domain,strategyId:input.strategyId,scenarioId:input.scenarioId,paperRunId:r.paperRunId,strategyResultId:r.strategyResultId,
    returnBps:r.returnBps,fillRateBps:r.aggregateFillRateBps,slippageBps:r.weightedSlippageBps,feesPaidMinor:r.feesPaid.minor.toString(),
    outcomeScore,executionQuality,evidenceIds:Object.freeze([...new Set(r.evidenceIds)].sort()),evaluatedAt:r.endedAt,authority:'LEARNING_ONLY',canAuthorizeLive:false,
  })
}

export function calibrateAutonomousStrategy(input:{
  domain:AutonomousLearningDomain
  strategyId:string
  records:readonly StrategyLearningRecord[]
  calibratedAt:string
  minimumSamples?:number
}):StrategyCalibration{
  const min=input.minimumSamples??20
  if(!Number.isInteger(min)||min<2)throw new Error('MONEY_AUTO_CALIBRATION_MIN_SAMPLES_INVALID')
  const xs=input.records.filter(r=>r.domain===input.domain&&r.strategyId===input.strategyId)
  if(xs.some(r=>r.authority!=='LEARNING_ONLY'||r.canAuthorizeLive!==false))throw new Error('MONEY_AUTO_CALIBRATION_AUTHORITY_INVALID')
  const n=xs.length
  const mean=(f:(r:StrategyLearningRecord)=>number)=>n?xs.reduce((s,r)=>s+f(r),0)/n:0
  const meanReturnBps=Math.round(mean(r=>r.returnBps))
  const downsideRateBps=n?Math.round(xs.filter(r=>r.returnBps<0).length*10000/n):0
  const meanFillRateBps=Math.round(mean(r=>r.fillRateBps))
  const meanAbsSlippageBps=Math.round(mean(r=>Math.abs(r.slippageBps)))
  const meanOutcomeScore=mean(r=>r.outcomeScore)
  const evidenceStrength=n?clamp(mean(r=>r.executionQuality)*Math.min(1,n/min),0,1):0
  let status:StrategyCalibration['status']='INSUFFICIENT_EVIDENCE'
  if(n>=min){
    if(meanReturnBps>0&&downsideRateBps<6000&&meanFillRateBps>=7000)status='SIMULATION_SUPPORTED'
    else if(meanReturnBps>-250&&downsideRateBps<7500)status='SIMULATION_MIXED'
    else status='SIMULATION_REJECTED'
  }
  const recommendedConfidenceBps=status==='SIMULATION_SUPPORTED'||status==='SIMULATION_MIXED'?Math.round(clamp(5000+meanOutcomeScore*3000*evidenceStrength,0,10000)):null
  const ids=Object.freeze(xs.map(r=>r.learningRecordId).sort())
  return Object.freeze({
    calibrationId:'auto-calibration:'+hash({domain:input.domain,strategyId:input.strategyId,ids,calibratedAt:input.calibratedAt}),domain:input.domain,strategyId:input.strategyId,sampleSize:n,
    meanReturnBps,downsideRateBps,meanFillRateBps,meanAbsSlippageBps,meanOutcomeScore,evidenceStrength,status,recommendedConfidenceBps,learningRecordIds:ids,calibratedAt:input.calibratedAt,
    authority:'LEARNING_ONLY',canAuthorizeLive:false,
  })
}

export function assessStrategyForAutonomousReview(input:{
  calibration:StrategyCalibration
  minSamples:number
  minMeanReturnBps:number
  minFillRateBps:number
  maxDownsideRateBps:number
  maxAbsSlippageBps:number
}):StrategyPromotionAssessment{
  const c=input.calibration,reasons:string[]=[]
  if(c.sampleSize<input.minSamples)reasons.push('INSUFFICIENT_SAMPLE')
  if(c.meanReturnBps<input.minMeanReturnBps)reasons.push('MEAN_RETURN_BELOW_THRESHOLD')
  if(c.meanFillRateBps<input.minFillRateBps)reasons.push('FILL_RATE_BELOW_THRESHOLD')
  if(c.downsideRateBps>input.maxDownsideRateBps)reasons.push('DOWNSIDE_RATE_ABOVE_THRESHOLD')
  if(c.meanAbsSlippageBps>input.maxAbsSlippageBps)reasons.push('SLIPPAGE_ABOVE_THRESHOLD')
  let status:StrategyPromotionAssessment['status']='ELIGIBLE_FOR_AUTONOMOUS_REVIEW'
  if(c.sampleSize<input.minSamples)status='INSUFFICIENT_DATA'
  else if(reasons.length||c.status==='SIMULATION_REJECTED')status='REJECTED'
  return Object.freeze({assessmentId:'auto-promotion:'+hash({calibration:c.calibrationId,criteria:input,reasons}),calibrationId:c.calibrationId,status,reasonCodes:Object.freeze(reasons),authority:'REVIEW_ONLY',canAuthorizeLive:false})
}

export function assertLearningCannotMutateMandate(target:'LEARNING'|'MANDATE_LIMITS'):void{
  if(target!=='LEARNING')throw new Error('MONEY_AUTO_LEARNING_CANNOT_MUTATE_HARD_LIMITS')
}
