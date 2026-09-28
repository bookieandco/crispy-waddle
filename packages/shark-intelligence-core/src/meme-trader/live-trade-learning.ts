import { createHash } from 'node:crypto'

export type TradeSignalOutcome=Readonly<{
 signalId:string
 signalName:string
 entryExpectation:string
 observedOutcome:string
 confidenceBps:number
 worked:boolean
 evidenceIds:readonly string[]
}>

export type ClosedMemeTradeLearningInput=Readonly<{
 tradeId:string
 runLineageId:string
 sourceAssessmentId:string
 sourceThesisId:string
 strategyId:string
 instrumentId:string
 openedAt:string
 exitedAt:string
 plannedEntryNotionalMinor:bigint
 realizedEntryNotionalMinor:bigint
 realizedExitNotionalMinor:bigint
 modeledSlippageBps:number
 realizedEntrySlippageBps:number
 realizedExitSlippageBps:number
 grossReturnBps:number
 netReturnBps:number
 feesPaidMinor:bigint
 expectedNarrative:string
 observedNarrative:string
 narrativeHeld:boolean
 signalOutcomes:readonly TradeSignalOutcome[]
 exitReasonCodes:readonly string[]
 originalEvidenceIds:readonly string[]
 outcomeEvidenceIds:readonly string[]
}>

export type SignalLearningAttribution=Readonly<{
 signalId:string
 signalName:string
 worked:boolean
 confidenceBps:number
 candidateWeightDeltaBps:number
 entryExpectation:string
 observedOutcome:string
 evidenceIds:readonly string[]
}>

export type ClosedMemeTradeLearningRecord=Readonly<{
 learningRecordId:string
 tradeId:string
 runLineageId:string
 sourceAssessmentId:string
 sourceThesisId:string
 strategyId:string
 instrumentId:string
 realized:{
  grossReturnBps:number
  netReturnBps:number
  feesPaidMinor:string
 }
 sizing:{
  plannedEntryNotionalMinor:string
  realizedEntryNotionalMinor:string
  sizingErrorBps:number
  diagnosis:'UNDER_SIZED'|'APPROPRIATE'|'OVER_SIZED'
 }
 execution:{
  modeledSlippageBps:number
  realizedAverageSlippageBps:number
  excessSlippageBps:number
  diagnosis:'BETTER_THAN_MODELED'|'AS_MODELED'|'WORSE_THAN_MODELED'
 }
 narrative:{
  expected:string
  observed:string
  held:boolean
  diagnosis:'CONFIRMED'|'DEGRADED_OR_FAILED'
 }
 signalAttribution:readonly SignalLearningAttribution[]
 signalsWorked:readonly string[]
 signalsFailed:readonly string[]
 exitReasonCodes:readonly string[]
 lessonTags:readonly string[]
 evidenceIds:readonly string[]
 createdAt:string
 authority:'LEARNING_ONLY'
 financialAuthority:'NONE'
 canExecute:false
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_,item)=>typeof item==='bigint'?item.toString():item)).digest('hex')
const iso=(value:string,code:string)=>{if(!value.trim()||Number.isNaN(Date.parse(value)))throw new Error(code)}
const slippageBps=(value:number,code:string)=>{if(!Number.isInteger(value)||value<-10000||value>10000)throw new Error(code)}
const returnBps=(value:number,code:string)=>{if(!Number.isInteger(value)||value<-10000||value>100000000)throw new Error(code)}
const confidence=(value:number)=>{if(!Number.isInteger(value)||value<0||value>10000)throw new Error('SHARK_TRADE_LEARNING_SIGNAL_CONFIDENCE_INVALID')}
const unique=(values:readonly string[])=>Object.freeze([...new Set(values)].sort())

export function createClosedMemeTradeLearningRecord(input:ClosedMemeTradeLearningInput):ClosedMemeTradeLearningRecord{
 if(!input.tradeId.trim()||!input.runLineageId.trim()||!input.sourceAssessmentId.trim()||!input.sourceThesisId.trim()||!input.strategyId.trim()||!input.instrumentId.trim())throw new Error('SHARK_TRADE_LEARNING_LINEAGE_REQUIRED')
 iso(input.openedAt,'SHARK_TRADE_LEARNING_OPENED_AT_INVALID')
 iso(input.exitedAt,'SHARK_TRADE_LEARNING_EXITED_AT_INVALID')
 if(input.exitedAt<input.openedAt)throw new Error('SHARK_TRADE_LEARNING_EXIT_BEFORE_OPEN')
 if(input.plannedEntryNotionalMinor<=0n||input.realizedEntryNotionalMinor<=0n||input.realizedExitNotionalMinor<0n||input.feesPaidMinor<0n)throw new Error('SHARK_TRADE_LEARNING_MONEY_INVALID')
 for(const [value,code] of [
  [input.modeledSlippageBps,'SHARK_TRADE_LEARNING_MODELED_SLIPPAGE_INVALID'],
  [input.realizedEntrySlippageBps,'SHARK_TRADE_LEARNING_ENTRY_SLIPPAGE_INVALID'],
  [input.realizedExitSlippageBps,'SHARK_TRADE_LEARNING_EXIT_SLIPPAGE_INVALID'],
 ] as const)slippageBps(value,code)
 returnBps(input.grossReturnBps,'SHARK_TRADE_LEARNING_GROSS_RETURN_INVALID')
 returnBps(input.netReturnBps,'SHARK_TRADE_LEARNING_NET_RETURN_INVALID')
 if(!input.expectedNarrative.trim()||!input.observedNarrative.trim())throw new Error('SHARK_TRADE_LEARNING_NARRATIVE_REQUIRED')
 if(!input.signalOutcomes.length)throw new Error('SHARK_TRADE_LEARNING_SIGNAL_OUTCOME_REQUIRED')
 if(!input.originalEvidenceIds.length||!input.outcomeEvidenceIds.length)throw new Error('SHARK_TRADE_LEARNING_EVIDENCE_REQUIRED')

 const sizingErrorBps=Number(((input.realizedEntryNotionalMinor-input.plannedEntryNotionalMinor)*10000n)/input.plannedEntryNotionalMinor)
 const sizingDiagnosis=sizingErrorBps>1000?'OVER_SIZED':sizingErrorBps<-1000?'UNDER_SIZED':'APPROPRIATE'
 const realizedAverageSlippageBps=Math.round((input.realizedEntrySlippageBps+input.realizedExitSlippageBps)/2)
 const excessSlippageBps=realizedAverageSlippageBps-input.modeledSlippageBps
 const executionDiagnosis=excessSlippageBps>50?'WORSE_THAN_MODELED':excessSlippageBps<-50?'BETTER_THAN_MODELED':'AS_MODELED'

 const signalAttribution=input.signalOutcomes.map(signal=>{
  confidence(signal.confidenceBps)
  if(!signal.signalId.trim()||!signal.signalName.trim()||!signal.entryExpectation.trim()||!signal.observedOutcome.trim()||!signal.evidenceIds.length)throw new Error('SHARK_TRADE_LEARNING_SIGNAL_INVALID')
  const magnitude=Math.max(50,Math.min(500,Math.round(signal.confidenceBps/20)))
  return Object.freeze({
   signalId:signal.signalId,
   signalName:signal.signalName,
   worked:signal.worked,
   confidenceBps:signal.confidenceBps,
   candidateWeightDeltaBps:signal.worked?magnitude:-magnitude,
   entryExpectation:signal.entryExpectation,
   observedOutcome:signal.observedOutcome,
   evidenceIds:unique(signal.evidenceIds),
  })
 })
 const signalsWorked=unique(signalAttribution.filter(item=>item.worked).map(item=>item.signalName))
 const signalsFailed=unique(signalAttribution.filter(item=>!item.worked).map(item=>item.signalName))
 const lessonTags:string[]=[]
 if(sizingDiagnosis!=='APPROPRIATE')lessonTags.push('SIZING_MISALIGNED')
 if(executionDiagnosis==='WORSE_THAN_MODELED')lessonTags.push('EXECUTION_COST_UNDERESTIMATED')
 if(!input.narrativeHeld)lessonTags.push('NARRATIVE_FAILED_OR_DEGRADED')
 if(signalsFailed.length)lessonTags.push('SIGNAL_FAILURE_PRESENT')
 if(input.netReturnBps>0)lessonTags.push('NET_PROFITABLE')
 else if(input.netReturnBps<0)lessonTags.push('NET_LOSS')
 else lessonTags.push('NET_FLAT')

 const evidenceIds=unique([
  ...input.originalEvidenceIds,
  ...input.outcomeEvidenceIds,
  ...signalAttribution.flatMap(item=>item.evidenceIds),
 ])

 return Object.freeze({
  learningRecordId:'shark-live-learning:'+hash({tradeId:input.tradeId,exitedAt:input.exitedAt,evidenceIds}),
  tradeId:input.tradeId,
  runLineageId:input.runLineageId,
  sourceAssessmentId:input.sourceAssessmentId,
  sourceThesisId:input.sourceThesisId,
  strategyId:input.strategyId,
  instrumentId:input.instrumentId,
  realized:Object.freeze({
   grossReturnBps:input.grossReturnBps,
   netReturnBps:input.netReturnBps,
   feesPaidMinor:input.feesPaidMinor.toString(),
  }),
  sizing:Object.freeze({
   plannedEntryNotionalMinor:input.plannedEntryNotionalMinor.toString(),
   realizedEntryNotionalMinor:input.realizedEntryNotionalMinor.toString(),
   sizingErrorBps,
   diagnosis:sizingDiagnosis,
  }),
  execution:Object.freeze({
   modeledSlippageBps:input.modeledSlippageBps,
   realizedAverageSlippageBps,
   excessSlippageBps,
   diagnosis:executionDiagnosis,
  }),
  narrative:Object.freeze({
   expected:input.expectedNarrative,
   observed:input.observedNarrative,
   held:input.narrativeHeld,
   diagnosis:input.narrativeHeld?'CONFIRMED':'DEGRADED_OR_FAILED',
  }),
  signalAttribution:Object.freeze(signalAttribution),
  signalsWorked,
  signalsFailed,
  exitReasonCodes:unique(input.exitReasonCodes),
  lessonTags:unique(lessonTags),
  evidenceIds,
  createdAt:input.exitedAt,
  authority:'LEARNING_ONLY',
  financialAuthority:'NONE',
  canExecute:false,
 })
}
