import {createHash} from 'node:crypto'

export const SHARK_SHADOW_LEARNING_VERSION='SHADOW-LEARNING-01' as const

export type SharkShadowHorizon='15M'|'1H'|'4H'|'24H'|'3D'|'7D'
export type SharkShadowAction='PAPER_TRADE'|'NO_TRADE'
export type SharkShadowRuntimeDisposition='BLOCKED'|'RESEARCH_ONLY'|'PURSE_REJECTED'|'PURSE_NOT_ALLOCATED'|'ALLOCATED'|'PREFLIGHT_BLOCKED'|'AUTONOMOUS_INTENT_READY'

export type SharkShadowMarketSnapshot=Readonly<{
  chainId:string
  tokenAddress:string
  liquidityUsd:number
  volume24hUsd:number
  buys24h:number
  sells24h:number
  anomalyScore:number
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
}>

export type SharkShadowDecisionTwin=Readonly<{
  schemaVersion:typeof SHARK_SHADOW_LEARNING_VERSION
  decisionId:string
  runtimeRunId:string
  envelopeId:string
  charterId:string
  userId:string
  cofferId:string
  opportunityId?:string
  chainId:string
  tokenAddress:string
  instrumentId:string
  strategyId:string
  tradeType:string
  runtimeDisposition:SharkShadowRuntimeDisposition
  action:SharkShadowAction
  side?:'BUY'|'SELL'
  proposedNotionalMinor:bigint
  confidenceBps:number
  sourceRiskBps:number
  sourceGroups:readonly string[]
  marketRegime:string
  market:SharkShadowMarketSnapshot
  reasonCodes:readonly string[]
  informationCutoff:string
  decidedAt:string
  evidenceIds:readonly string[]
  authority:'SHADOW_DECISION_ONLY'
  canExecute:false
}>

export type SharkShadowExecutionSimulation=Readonly<{
  simulationId:string
  decisionId:string
  action:SharkShadowAction
  side?:'BUY'|'SELL'
  requestedNotionalMinor:bigint
  estimatedFilledMinor:bigint
  fillRatioBps:number
  liquidityParticipationBps:number
  spreadBps:number
  slippageBps:number
  feeBps:number
  latencyPenaltyBps:number
  totalEstimatedCostBps:number
  routeSource:'EXECUTION_PACKAGE'|'LIQUIDITY_MODEL'|'NO_TRADE'
  simulatedAt:string
  evidenceIds:readonly string[]
  authority:'SHADOW_EXECUTION_SIMULATION_ONLY'
  canSign:false
  canBroadcast:false
  canExecute:false
}>

export type SharkShadowOutcomeObservation=Readonly<{
  observationId:string
  decisionId:string
  horizon:SharkShadowHorizon
  baselineLaunchReturnPct?:number
  observedLaunchReturnPct?:number
  underlyingReturnBps?:number
  returnBasis:'DECISION_RELATIVE'|'LAUNCH_RELATIVE'|'UNAVAILABLE'
  peakReturnPct?:number
  maxDrawdownPct?:number
  maxFavorableExcursionBps?:number
  maxAdverseExcursionBps?:number
  baselineLiquidityUsd?:number
  observedLiquidityUsd?:number
  liquidityChangeBps?:number
  launchOutcome?:'UNKNOWN'|'HEALTHY'|'RUG'|'FAILED'|'PUMP_AND_DUMP'
  liquidityRemoved?:boolean
  tradingHalted?:boolean
  observedAt:string
  evidenceIds:readonly string[]
  authority:'SHADOW_OUTCOME_ONLY'
  canExecute:false
}>

export type SharkShadowCounterfactualLesson=Readonly<{
  lessonId:string
  decisionId:string
  userId:string
  strategyId:string
  instrumentId:string
  horizon:SharkShadowHorizon
  action:SharkShadowAction
  marketRegime:string
  sourceGroups:readonly string[]
  confidenceBps:number
  underlyingReturnBps:number
  decisionReturnBps:number
  decisionQualityBps:number
  avoidedLossBps:number
  missedGainBps:number
  executionCostBps:number
  regretBps:number
  confidenceErrorBps:number
  timingDiagnosis:'GOOD_ENTRY'|'EARLY'|'LATE'|'NO_TRADE_CORRECT'|'NO_TRADE_MISSED'|'INCONCLUSIVE'
  thesisHeld:boolean
  lessonTags:readonly string[]
  evaluatedAt:string
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  financialAuthority:'NONE'
  canExecute:false
  canAuthorizeLive:false
}>

export type SharkShadowSourceReliability=Readonly<{
  sourceGroup:string
  sampleSize:number
  positiveRateBps:number
  meanDecisionQualityBps:number
}>

export type SharkShadowPerformanceMims=Readonly<{
  voteId:string
  status:'PASS'|'REVIEW'|'FAIL'
  reasonCodes:readonly string[]
  sampleSize:number
  meanDecisionQualityBps:number
  winRateBps:number
  meanExecutionCostBps:number
  meanConfidenceErrorBps:number
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

export type SharkShadowPerformanceCalibration=Readonly<{
  calibrationId:string
  userId:string
  strategyId:string
  sampleSize:number
  tradeSamples:number
  noTradeSamples:number
  winRateBps:number
  meanDecisionReturnBps:number
  meanDecisionQualityBps:number
  meanAvoidedLossBps:number
  meanMissedGainBps:number
  meanExecutionCostBps:number
  meanRegretBps:number
  meanConfidenceErrorBps:number
  recommendedConfidenceAdjustmentBps:number
  status:'INSUFFICIENT_EVIDENCE'|'SIMULATION_SUPPORTED'|'SIMULATION_MIXED'|'SIMULATION_REJECTED'
  sourceReliability:readonly SharkShadowSourceReliability[]
  performanceMims:SharkShadowPerformanceMims
  lessonIds:readonly string[]
  calibratedAt:string
  authority:'LEARNING_ONLY'
  canMutateMandate:false
  canAuthorizeLive:false
}>

export type SharkShadowMemoryCard=Readonly<{
  memoryId:string
  userId:string
  strategyId:string
  patternKey:string
  marketRegime:string
  sampleSize:number
  winRateBps:number
  meanDecisionQualityBps:number
  meanExecutionCostBps:number
  meanAvoidedLossBps:number
  meanMissedGainBps:number
  confidenceAdjustmentBps:number
  sourceReliability:readonly SharkShadowSourceReliability[]
  lessonIds:readonly string[]
  evidenceIds:readonly string[]
  createdAt:string
  authority:'LEARNING_MEMORY_ONLY'
  canAuthorizeLive:false
}>

export type SharkShadowReplayManifest=Readonly<{
  replayId:string
  userId:string
  from:string
  to:string
  generatedAt:string
  decisionIds:readonly string[]
  observationIds:readonly string[]
  lessonIds:readonly string[]
  futureEvidenceRejected:number
  authority:'RESEARCH_REPLAY_ONLY'
  canExecute:false
  canAuthorizeLive:false
}>

export type SharkShadowLearningFinalReport=Readonly<{
  reportId:string
  passed:boolean
  gates:Readonly<Record<'ledger'|'decisionTwin'|'executionSimulation'|'outcomeObserver'|'counterfactual'|'performanceMims'|'memory'|'continuousRuntime'|'replay'|'authorityBoundary',boolean>>
  reasonCodes:readonly string[]
  liveExecutionAuthorized:false
  authority:'CERTIFICATION_ONLY'
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs.filter(Boolean))].sort())
const iso=(v:string,code:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(code)}
const finite=(v:number,code:string)=>{if(!Number.isFinite(v))throw new Error(code)}
const mean=(xs:readonly number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0

export function sharkShadowStrategyId(tradeType:string):string{
  switch(tradeType){
    case 'new-pair-speculation':return 'SHARK_RUNTIME_NEW_PAIR'
    case 'narrative':return 'SHARK_RUNTIME_NARRATIVE'
    case 'swing-hold':return 'SHARK_RUNTIME_SWING'
    case 'high-conviction':return 'SHARK_RUNTIME_HIGH_CONVICTION'
    case 'information-edge':return 'SHARK_RUNTIME_INFORMATION_EDGE'
    default:return 'SHARK_RUNTIME_MEME'
  }
}

export function sharkShadowMarketRegime(market:Pick<SharkShadowMarketSnapshot,'liquidityUsd'|'volume24hUsd'|'buys24h'|'sells24h'|'anomalyScore'>):string{
  const liquidity=market.liquidityUsd<25000?'LOW_LIQUIDITY':market.liquidityUsd<100000?'MID_LIQUIDITY':'HIGH_LIQUIDITY'
  const anomaly=market.anomalyScore>=.8?'HIGH_ANOMALY':market.anomalyScore>=.5?'MID_ANOMALY':'LOW_ANOMALY'
  const total=market.buys24h+market.sells24h
  const skew=total?((market.buys24h-market.sells24h)/total):0
  const flow=skew>.1?'BUY_FLOW':skew<-.1?'SELL_FLOW':'BALANCED_FLOW'
  const turnover=market.liquidityUsd>0?market.volume24hUsd/market.liquidityUsd:0
  const activity=turnover>=2?'HIGH_TURNOVER':turnover>=.5?'MID_TURNOVER':'LOW_TURNOVER'
  return [liquidity,anomaly,flow,activity].join(':')
}

export function buildSharkShadowDecisionTwin(input:Readonly<{
  runtimeRunId:string
  envelopeId:string
  charterId:string
  userId:string
  cofferId:string
  opportunityId?:string
  disposition:SharkShadowRuntimeDisposition
  tradeType:string
  chainId:string
  tokenAddress:string
  instrumentId:string
  sourceConfidence:number
  sourceRisk:number
  sourceGroups:readonly string[]
  proposedNotionalMinor?:bigint
  side?:'BUY'|'SELL'
  informationCutoff:string
  decidedAt:string
  market:SharkShadowMarketSnapshot
  evidenceIds:readonly string[]
}>):SharkShadowDecisionTwin{
  for(const [v,c] of [[input.runtimeRunId,'SHADOW_RUNTIME_RUN_REQUIRED'],[input.envelopeId,'SHADOW_ENVELOPE_REQUIRED'],[input.charterId,'SHADOW_CHARTER_REQUIRED'],[input.userId,'SHADOW_USER_REQUIRED'],[input.cofferId,'SHADOW_COFFER_REQUIRED'],[input.tradeType,'SHADOW_TRADE_TYPE_REQUIRED'],[input.chainId,'SHADOW_CHAIN_REQUIRED'],[input.tokenAddress,'SHADOW_TOKEN_REQUIRED'],[input.instrumentId,'SHADOW_INSTRUMENT_REQUIRED']] as const)if(!v.trim())throw new Error(c)
  iso(input.informationCutoff,'SHADOW_INFORMATION_CUTOFF_INVALID')
  iso(input.decidedAt,'SHADOW_DECIDED_AT_INVALID')
  iso(input.market.observedAt,'SHADOW_MARKET_OBSERVED_AT_INVALID')
  iso(input.market.availableAt,'SHADOW_MARKET_AVAILABLE_AT_INVALID')
  if(input.market.availableAt>input.informationCutoff)throw new Error('SHADOW_FUTURE_MARKET_EVIDENCE_FORBIDDEN')
  for(const [v,c] of [[input.sourceConfidence,'SHADOW_CONFIDENCE_INVALID'],[input.sourceRisk,'SHADOW_SOURCE_RISK_INVALID'],[input.market.anomalyScore,'SHADOW_ANOMALY_INVALID']] as const){finite(v,c);if(v<0||v>1)throw new Error(c)}
  for(const [v,c] of [[input.market.liquidityUsd,'SHADOW_LIQUIDITY_INVALID'],[input.market.volume24hUsd,'SHADOW_VOLUME_INVALID'],[input.market.buys24h,'SHADOW_BUYS_INVALID'],[input.market.sells24h,'SHADOW_SELLS_INVALID']] as const){finite(v,c);if(v<0)throw new Error(c)}
  const action:SharkShadowAction=input.disposition==='ALLOCATED'||input.disposition==='AUTONOMOUS_INTENT_READY'?'PAPER_TRADE':'NO_TRADE'
  const side=action==='PAPER_TRADE'?(input.side??'BUY'):undefined
  const proposedNotionalMinor=action==='PAPER_TRADE'?(input.proposedNotionalMinor??0n):0n
  if(proposedNotionalMinor<0n)throw new Error('SHADOW_NOTIONAL_INVALID')
  const strategyId=sharkShadowStrategyId(input.tradeType)
  const marketRegime=sharkShadowMarketRegime(input.market)
  const reasonCodes=[input.disposition]
  if(input.market.liquidityUsd<25000)reasonCodes.push('LOW_LIQUIDITY')
  if(input.market.anomalyScore>=.8)reasonCodes.push('HIGH_ANOMALY')
  if(action==='NO_TRADE')reasonCodes.push('COUNTERFACTUAL_TRACK_REQUIRED')
  const evidenceIds=unique([...input.evidenceIds,...input.market.evidenceIds])
  if(!evidenceIds.length)throw new Error('SHADOW_EVIDENCE_REQUIRED')
  const payload={runtimeRunId:input.runtimeRunId,envelopeId:input.envelopeId,charterId:input.charterId,disposition:input.disposition,strategyId,action,side,proposedNotionalMinor,informationCutoff:input.informationCutoff}
  return Object.freeze({
    schemaVersion:SHARK_SHADOW_LEARNING_VERSION,
    decisionId:'shark-shadow-decision:'+hash(payload),
    runtimeRunId:input.runtimeRunId,envelopeId:input.envelopeId,charterId:input.charterId,userId:input.userId,cofferId:input.cofferId,
    opportunityId:input.opportunityId,chainId:input.chainId,tokenAddress:input.tokenAddress,instrumentId:input.instrumentId,strategyId,tradeType:input.tradeType,
    runtimeDisposition:input.disposition,action,side,proposedNotionalMinor,
    confidenceBps:clamp(Math.round(input.sourceConfidence*10000),0,10000),
    sourceRiskBps:clamp(Math.round(input.sourceRisk*10000),0,10000),
    sourceGroups:unique(input.sourceGroups),marketRegime,market:Object.freeze({...input.market,evidenceIds:unique(input.market.evidenceIds)}),
    reasonCodes:unique(reasonCodes),informationCutoff:input.informationCutoff,decidedAt:input.decidedAt,evidenceIds,
    authority:'SHADOW_DECISION_ONLY',canExecute:false,
  })
}

export function simulateSharkShadowExecution(input:Readonly<{
  decision:SharkShadowDecisionTwin
  simulatedAt:string
  requestedNotionalMinor?:bigint
  feeBps?:number
  routeSource?:'EXECUTION_PACKAGE'|'LIQUIDITY_MODEL'
  routeEvidenceIds?:readonly string[]
}>):SharkShadowExecutionSimulation{
  iso(input.simulatedAt,'SHADOW_SIMULATION_TIME_INVALID')
  if(input.decision.authority!=='SHADOW_DECISION_ONLY'||input.decision.canExecute!==false)throw new Error('SHADOW_DECISION_AUTHORITY_INVALID')
  if(input.decision.action==='NO_TRADE'){
    return Object.freeze({
      simulationId:'shark-shadow-sim:'+hash({decisionId:input.decision.decisionId,action:'NO_TRADE'}),
      decisionId:input.decision.decisionId,action:'NO_TRADE',requestedNotionalMinor:0n,estimatedFilledMinor:0n,fillRatioBps:0,liquidityParticipationBps:0,
      spreadBps:0,slippageBps:0,feeBps:0,latencyPenaltyBps:0,totalEstimatedCostBps:0,routeSource:'NO_TRADE',simulatedAt:input.simulatedAt,
      evidenceIds:input.decision.evidenceIds,authority:'SHADOW_EXECUTION_SIMULATION_ONLY',canSign:false,canBroadcast:false,canExecute:false,
    })
  }
  const requested=input.requestedNotionalMinor??input.decision.proposedNotionalMinor
  if(requested<=0n)throw new Error('SHADOW_TRADE_NOTIONAL_REQUIRED')
  const m=input.decision.market
  const requestedUsd=Number(requested)/100
  const participation=m.liquidityUsd>0?Math.round(requestedUsd/m.liquidityUsd*10000):10000
  const totalFlow=m.buys24h+m.sells24h
  const flowSkew=totalFlow?Math.abs(m.buys24h-m.sells24h)/totalFlow:0
  const turnover=m.liquidityUsd>0?m.volume24hUsd/m.liquidityUsd:0
  const spreadBps=clamp(Math.round(10+m.anomalyScore*35+Math.max(0,1-turnover)*20),1,500)
  const slippageBps=clamp(Math.round(4+Math.sqrt(Math.max(0,participation))*2+m.anomalyScore*80+(m.liquidityUsd<25000?50:0)),0,2500)
  const feeBps=input.feeBps??30
  if(!Number.isInteger(feeBps)||feeBps<0||feeBps>2500)throw new Error('SHADOW_FEE_BPS_INVALID')
  const latencyPenaltyBps=clamp(Math.round(2+m.anomalyScore*18+flowSkew*12),0,100)
  const totalEstimatedCostBps=clamp(spreadBps+slippageBps+feeBps+latencyPenaltyBps,0,5000)
  const fillRatioBps=clamp(10000-Math.max(0,participation-100)*2-Math.round(m.anomalyScore*500),1000,10000)
  const estimatedFilledMinor=requested*BigInt(fillRatioBps)/10000n
  return Object.freeze({
    simulationId:'shark-shadow-sim:'+hash({decisionId:input.decision.decisionId,requested:requested.toString(),participation,spreadBps,slippageBps,feeBps,latencyPenaltyBps,routeSource:input.routeSource??'LIQUIDITY_MODEL'}),
    decisionId:input.decision.decisionId,action:input.decision.action,side:input.decision.side,requestedNotionalMinor:requested,estimatedFilledMinor,fillRatioBps,
    liquidityParticipationBps:participation,spreadBps,slippageBps,feeBps,latencyPenaltyBps,totalEstimatedCostBps,
    routeSource:input.routeSource??'LIQUIDITY_MODEL',simulatedAt:input.simulatedAt,
    evidenceIds:unique([...input.decision.evidenceIds,...(input.routeEvidenceIds??[])]),
    authority:'SHADOW_EXECUTION_SIMULATION_ONLY',canSign:false,canBroadcast:false,canExecute:false,
  })
}

function returnBpsFromLaunchPct(baseline:number|undefined,observed:number|undefined):Readonly<{bps?:number;basis:SharkShadowOutcomeObservation['returnBasis']}>{
  if(observed===undefined||!Number.isFinite(observed))return {basis:'UNAVAILABLE'}
  if(baseline!==undefined&&Number.isFinite(baseline)){
    const base=1+baseline/100,now=1+observed/100
    if(base>0&&now>=0)return {bps:Math.round((now/base-1)*10000),basis:'DECISION_RELATIVE'}
  }
  return {bps:Math.round(observed*100),basis:'LAUNCH_RELATIVE'}
}

export function observeSharkShadowOutcome(input:Readonly<{
  decision:SharkShadowDecisionTwin
  horizon:SharkShadowHorizon
  observedAt:string
  baselineLaunchReturnPct?:number
  observedLaunchReturnPct?:number
  peakReturnPct?:number
  maxDrawdownPct?:number
  baselineLiquidityUsd?:number
  observedLiquidityUsd?:number
  launchOutcome?:SharkShadowOutcomeObservation['launchOutcome']
  liquidityRemoved?:boolean
  tradingHalted?:boolean
  evidenceIds:readonly string[]
}>):SharkShadowOutcomeObservation{
  iso(input.observedAt,'SHADOW_OUTCOME_TIME_INVALID')
  if(Date.parse(input.observedAt)<=Date.parse(input.decision.decidedAt))throw new Error('SHADOW_OUTCOME_NOT_AFTER_DECISION')
  const result=returnBpsFromLaunchPct(input.baselineLaunchReturnPct,input.observedLaunchReturnPct)
  const liquidityChangeBps=input.baselineLiquidityUsd!==undefined&&input.observedLiquidityUsd!==undefined&&input.baselineLiquidityUsd>0
    ?Math.round((input.observedLiquidityUsd/input.baselineLiquidityUsd-1)*10000):undefined
  const maxFavorableExcursionBps=input.peakReturnPct===undefined?undefined:Math.round(input.peakReturnPct*100)
  const maxAdverseExcursionBps=input.maxDrawdownPct===undefined?undefined:Math.round(input.maxDrawdownPct*100)
  const evidenceIds=unique([...input.decision.evidenceIds,...input.evidenceIds])
  if(!evidenceIds.length)throw new Error('SHADOW_OUTCOME_EVIDENCE_REQUIRED')
  return Object.freeze({
    observationId:'shark-shadow-observation:'+hash({decisionId:input.decision.decisionId,horizon:input.horizon,observedAt:input.observedAt,evidenceIds}),
    decisionId:input.decision.decisionId,horizon:input.horizon,baselineLaunchReturnPct:input.baselineLaunchReturnPct,observedLaunchReturnPct:input.observedLaunchReturnPct,
    underlyingReturnBps:result.bps,returnBasis:result.basis,peakReturnPct:input.peakReturnPct,maxDrawdownPct:input.maxDrawdownPct,maxFavorableExcursionBps,maxAdverseExcursionBps,
    baselineLiquidityUsd:input.baselineLiquidityUsd,observedLiquidityUsd:input.observedLiquidityUsd,liquidityChangeBps,launchOutcome:input.launchOutcome,
    liquidityRemoved:input.liquidityRemoved,tradingHalted:input.tradingHalted,observedAt:input.observedAt,evidenceIds,
    authority:'SHADOW_OUTCOME_ONLY',canExecute:false,
  })
}

export function buildSharkShadowCounterfactual(input:Readonly<{
  decision:SharkShadowDecisionTwin
  execution:SharkShadowExecutionSimulation
  observation:SharkShadowOutcomeObservation
}>):SharkShadowCounterfactualLesson{
  if(input.execution.decisionId!==input.decision.decisionId||input.observation.decisionId!==input.decision.decisionId)throw new Error('SHADOW_LESSON_BINDING_INVALID')
  const underlying=input.observation.underlyingReturnBps??0
  const executionCost=input.decision.action==='PAPER_TRADE'?input.execution.totalEstimatedCostBps:0
  const signedUnderlying=input.decision.side==='SELL'?-underlying:underlying
  const decisionReturn=input.decision.action==='PAPER_TRADE'?signedUnderlying-executionCost:0
  const quality=input.decision.action==='NO_TRADE'?-underlying:decisionReturn
  const avoidedLoss=input.decision.action==='NO_TRADE'?Math.max(0,-underlying):0
  const missedGain=input.decision.action==='NO_TRADE'?Math.max(0,underlying):0
  const favorable=input.observation.maxFavorableExcursionBps??Math.max(0,underlying)
  const regret=input.decision.action==='NO_TRADE'?missedGain:Math.max(0,favorable-decisionReturn)
  const outcomeScore=quality>0?10000:quality<0?0:5000
  const confidenceError=Math.abs(input.decision.confidenceBps-outcomeScore)
  const thesisHeld=!['RUG','FAILED','PUMP_AND_DUMP'].includes(input.observation.launchOutcome??'UNKNOWN')&&underlying>=-500
  let timing:SharkShadowCounterfactualLesson['timingDiagnosis']='INCONCLUSIVE'
  if(input.decision.action==='NO_TRADE')timing=underlying>250?'NO_TRADE_MISSED':'NO_TRADE_CORRECT'
  else if(decisionReturn>0&&regret<=500)timing='GOOD_ENTRY'
  else if(decisionReturn<0&&favorable>500)timing='EARLY'
  else if(decisionReturn<0)timing='LATE'
  const tags:string[]=[]
  tags.push(quality>0?'DECISION_POSITIVE':quality<0?'DECISION_NEGATIVE':'DECISION_FLAT')
  if(avoidedLoss>0)tags.push('AVOIDED_LOSS')
  if(missedGain>0)tags.push('MISSED_GAIN')
  if(executionCost>=150)tags.push('EXECUTION_COST_HIGH')
  if(input.observation.liquidityRemoved)tags.push('LIQUIDITY_REMOVED')
  if(input.observation.tradingHalted)tags.push('TRADING_HALTED')
  if(input.observation.launchOutcome==='RUG')tags.push('RUG_OUTCOME')
  if(input.observation.liquidityChangeBps!==undefined&&input.observation.liquidityChangeBps<=-5000)tags.push('LIQUIDITY_COLLAPSE')
  if(confidenceError>=5000)tags.push('CONFIDENCE_MISCALIBRATED')
  if(!thesisHeld)tags.push('THESIS_FAILED_OR_DEGRADED')
  const evidenceIds=unique([...input.decision.evidenceIds,...input.execution.evidenceIds,...input.observation.evidenceIds])
  return Object.freeze({
    lessonId:'shark-shadow-lesson:'+hash({decisionId:input.decision.decisionId,horizon:input.observation.horizon,observationId:input.observation.observationId}),
    decisionId:input.decision.decisionId,userId:input.decision.userId,strategyId:input.decision.strategyId,instrumentId:input.decision.instrumentId,
    horizon:input.observation.horizon,action:input.decision.action,marketRegime:input.decision.marketRegime,sourceGroups:input.decision.sourceGroups,
    confidenceBps:input.decision.confidenceBps,underlyingReturnBps:underlying,decisionReturnBps:decisionReturn,decisionQualityBps:quality,
    avoidedLossBps:avoidedLoss,missedGainBps:missedGain,executionCostBps:executionCost,regretBps:regret,confidenceErrorBps:confidenceError,
    timingDiagnosis:timing,thesisHeld,lessonTags:unique(tags),evaluatedAt:input.observation.observedAt,evidenceIds,
    authority:'LEARNING_ONLY',financialAuthority:'NONE',canExecute:false,canAuthorizeLive:false,
  })
}

export function evaluateSharkShadowPerformanceMims(input:Readonly<{strategyId:string;lessons:readonly SharkShadowCounterfactualLesson[]}>):SharkShadowPerformanceMims{
  const xs=input.lessons.filter(x=>x.strategyId===input.strategyId)
  const sample=xs.length
  const meanQuality=Math.round(mean(xs.map(x=>x.decisionQualityBps)))
  const winRate=sample?Math.round(xs.filter(x=>x.decisionQualityBps>0).length*10000/sample):0
  const meanCost=Math.round(mean(xs.map(x=>x.executionCostBps)))
  const meanError=Math.round(mean(xs.map(x=>x.confidenceErrorBps)))
  const reasons:string[]=[]
  let status:SharkShadowPerformanceMims['status']='PASS'
  if(sample<20){status='REVIEW';reasons.push('INSUFFICIENT_SAMPLE')}
  if(sample>=20&&meanQuality<=0){status='FAIL';reasons.push('NON_POSITIVE_DECISION_QUALITY')}
  if(sample>=20&&winRate<4500){status='FAIL';reasons.push('WIN_RATE_BELOW_FLOOR')}
  if(meanCost>500){status=status==='FAIL'?'FAIL':'REVIEW';reasons.push('EXECUTION_COST_HIGH')}
  if(meanError>4500){status=status==='FAIL'?'FAIL':'REVIEW';reasons.push('CONFIDENCE_CALIBRATION_WEAK')}
  if(!reasons.length)reasons.push('PERFORMANCE_COHERENT_WITH_SHADOW_EVIDENCE')
  return Object.freeze({
    voteId:'shark-shadow-performance-mims:'+hash({strategyId:input.strategyId,lessonIds:xs.map(x=>x.lessonId).sort()}),
    status,reasonCodes:unique(reasons),sampleSize:sample,meanDecisionQualityBps:meanQuality,winRateBps:winRate,meanExecutionCostBps:meanCost,meanConfidenceErrorBps:meanError,
    authority:'LEARNING_ONLY',canAuthorizeLive:false,
  })
}

export function calibrateSharkShadowPerformance(input:Readonly<{
  userId:string
  strategyId:string
  lessons:readonly SharkShadowCounterfactualLesson[]
  calibratedAt:string
}>):SharkShadowPerformanceCalibration{
  iso(input.calibratedAt,'SHADOW_CALIBRATION_TIME_INVALID')
  const xs=input.lessons.filter(x=>x.userId===input.userId&&x.strategyId===input.strategyId&&x.evaluatedAt<=input.calibratedAt)
  const n=xs.length
  const avg=(f:(x:SharkShadowCounterfactualLesson)=>number)=>Math.round(mean(xs.map(f)))
  const winRate=n?Math.round(xs.filter(x=>x.decisionQualityBps>0).length*10000/n):0
  const sources=unique(xs.flatMap(x=>x.sourceGroups)).map(sourceGroup=>{
    const ys=xs.filter(x=>x.sourceGroups.includes(sourceGroup))
    return Object.freeze({sourceGroup,sampleSize:ys.length,positiveRateBps:ys.length?Math.round(ys.filter(x=>x.decisionQualityBps>0).length*10000/ys.length):0,meanDecisionQualityBps:Math.round(mean(ys.map(x=>x.decisionQualityBps)))})
  })
  const mims=evaluateSharkShadowPerformanceMims({strategyId:input.strategyId,lessons:xs})
  let status:SharkShadowPerformanceCalibration['status']='INSUFFICIENT_EVIDENCE'
  if(n>=20){
    status=mims.status==='PASS'?'SIMULATION_SUPPORTED':mims.status==='FAIL'?'SIMULATION_REJECTED':'SIMULATION_MIXED'
  }
  const quality=avg(x=>x.decisionQualityBps)
  const error=avg(x=>x.confidenceErrorBps)
  const recommendedConfidenceAdjustmentBps=clamp(Math.round(quality*.15-(error-2500)*.08),-1500,1000)
  return Object.freeze({
    calibrationId:'shark-shadow-calibration:'+hash({userId:input.userId,strategyId:input.strategyId,lessonIds:xs.map(x=>x.lessonId).sort(),calibratedAt:input.calibratedAt}),
    userId:input.userId,strategyId:input.strategyId,sampleSize:n,tradeSamples:xs.filter(x=>x.action==='PAPER_TRADE').length,noTradeSamples:xs.filter(x=>x.action==='NO_TRADE').length,
    winRateBps:winRate,meanDecisionReturnBps:avg(x=>x.decisionReturnBps),meanDecisionQualityBps:quality,meanAvoidedLossBps:avg(x=>x.avoidedLossBps),
    meanMissedGainBps:avg(x=>x.missedGainBps),meanExecutionCostBps:avg(x=>x.executionCostBps),meanRegretBps:avg(x=>x.regretBps),meanConfidenceErrorBps:error,
    recommendedConfidenceAdjustmentBps,status,sourceReliability:Object.freeze(sources),performanceMims:mims,lessonIds:unique(xs.map(x=>x.lessonId)),calibratedAt:input.calibratedAt,
    authority:'LEARNING_ONLY',canMutateMandate:false,canAuthorizeLive:false,
  })
}

export function buildSharkShadowMemoryCard(input:Readonly<{
  userId:string
  strategyId:string
  marketRegime:string
  lessons:readonly SharkShadowCounterfactualLesson[]
  calibration:SharkShadowPerformanceCalibration
  createdAt:string
}>):SharkShadowMemoryCard{
  iso(input.createdAt,'SHADOW_MEMORY_TIME_INVALID')
  if(input.calibration.userId!==input.userId||input.calibration.strategyId!==input.strategyId)throw new Error('SHADOW_MEMORY_CALIBRATION_BINDING_INVALID')
  const xs=input.lessons.filter(x=>x.userId===input.userId&&x.strategyId===input.strategyId&&x.marketRegime===input.marketRegime&&x.evaluatedAt<=input.createdAt)
  const n=xs.length
  const avg=(f:(x:SharkShadowCounterfactualLesson)=>number)=>Math.round(mean(xs.map(f)))
  const winRate=n?Math.round(xs.filter(x=>x.decisionQualityBps>0).length*10000/n):0
  const evidenceIds=unique(xs.flatMap(x=>x.evidenceIds))
  const patternKey=[input.strategyId,input.marketRegime].join('|')
  return Object.freeze({
    memoryId:'shark-shadow-memory:'+hash({userId:input.userId,patternKey,lessonIds:xs.map(x=>x.lessonId).sort(),calibrationId:input.calibration.calibrationId}),
    userId:input.userId,strategyId:input.strategyId,patternKey,marketRegime:input.marketRegime,sampleSize:n,winRateBps:winRate,
    meanDecisionQualityBps:avg(x=>x.decisionQualityBps),meanExecutionCostBps:avg(x=>x.executionCostBps),meanAvoidedLossBps:avg(x=>x.avoidedLossBps),
    meanMissedGainBps:avg(x=>x.missedGainBps),confidenceAdjustmentBps:input.calibration.recommendedConfidenceAdjustmentBps,
    sourceReliability:input.calibration.sourceReliability,lessonIds:unique(xs.map(x=>x.lessonId)),evidenceIds,createdAt:input.createdAt,
    authority:'LEARNING_MEMORY_ONLY',canAuthorizeLive:false,
  })
}

export function retrieveSimilarSharkShadowMemory(input:Readonly<{
  strategyId:string
  marketRegime:string
  cards:readonly SharkShadowMemoryCard[]
  limit?:number
}>):readonly SharkShadowMemoryCard[]{
  const limit=Math.max(1,Math.min(20,Math.trunc(input.limit??5)))
  const target=new Set(input.marketRegime.split(':'))
  return Object.freeze(input.cards
    .filter(x=>x.strategyId===input.strategyId)
    .map(card=>{
      const parts=new Set(card.marketRegime.split(':'))
      let overlap=0
      for(const p of target)if(parts.has(p))overlap++
      return {card,score:overlap*1000+Math.min(999,card.sampleSize)}
    })
    .sort((a,b)=>b.score-a.score||b.card.createdAt.localeCompare(a.card.createdAt))
    .slice(0,limit)
    .map(x=>x.card))
}

export function buildSharkShadowReplayManifest(input:Readonly<{
  userId:string
  from:string
  to:string
  generatedAt:string
  decisionIds:readonly string[]
  observationIds:readonly string[]
  lessonIds:readonly string[]
  futureEvidenceRejected?:number
}>):SharkShadowReplayManifest{
  iso(input.from,'SHADOW_REPLAY_FROM_INVALID');iso(input.to,'SHADOW_REPLAY_TO_INVALID');iso(input.generatedAt,'SHADOW_REPLAY_GENERATED_AT_INVALID')
  if(input.to<input.from||input.to>input.generatedAt)throw new Error('SHADOW_REPLAY_WINDOW_INVALID')
  const decisionIds=unique(input.decisionIds),observationIds=unique(input.observationIds),lessonIds=unique(input.lessonIds)
  return Object.freeze({
    replayId:'shark-shadow-replay:'+hash({userId:input.userId,from:input.from,to:input.to,decisionIds,observationIds,lessonIds}),
    userId:input.userId,from:input.from,to:input.to,generatedAt:input.generatedAt,decisionIds,observationIds,lessonIds,
    futureEvidenceRejected:Math.max(0,Math.trunc(input.futureEvidenceRejected??0)),authority:'RESEARCH_REPLAY_ONLY',canExecute:false,canAuthorizeLive:false,
  })
}

export function certifySharkShadowLearningFinal(input:Readonly<{
  ledger:boolean
  decisionTwin:boolean
  executionSimulation:boolean
  outcomeObserver:boolean
  counterfactual:boolean
  performanceMims:boolean
  memory:boolean
  continuousRuntime:boolean
  replay:boolean
  authorityBoundary:boolean
}>):SharkShadowLearningFinalReport{
  const gates=Object.freeze({...input})
  const reasons=Object.entries(gates).filter(([,passed])=>!passed).map(([name])=>'GATE_FAILED:'+name)
  const passed=reasons.length===0
  return Object.freeze({
    reportId:'shark-shadow-learning-final:'+hash(gates),passed,gates,reasonCodes:Object.freeze(reasons),liveExecutionAuthorized:false,authority:'CERTIFICATION_ONLY',
  })
}
