import {
 certifyDexExecutionLadder,
 certifyDexExecutionStage,
 type DexExecutionLadderReport,
 type DexExecutionStage,
 type DexExecutionStageEvidence,
 type DexLiveCanaryVerificationReceipt,
} from './dex-four-stage-certification.js'
import type { CofferCommissionFinalReport } from './coffer-commission-final.js'

export type DexStageRunClass='REAL_RUNTIME'|'TEST_FIXTURE'

export type DexStageRunResult=Readonly<{
 evidence:DexExecutionStageEvidence
 runClass:DexStageRunClass
 runtimeEvidenceIds:readonly string[]
}>

export interface DexStageExecutor{
 readonly stage:DexExecutionStage
 run(input:{
  priorStages:readonly DexExecutionStageEvidence[]
  runLineageId:string
  strategyId:string
  instrumentId:string
 }):Promise<DexStageRunResult>
}

export interface DexControlledCanaryExecutor extends DexStageExecutor{
 readonly stage:'CONTROLLED_LIVE_CANARY'
 run(input:{
  priorStages:readonly DexExecutionStageEvidence[]
  runLineageId:string
  strategyId:string
  instrumentId:string
 }):Promise<DexStageRunResult&Readonly<{verification:DexLiveCanaryVerificationReceipt}>>
}

export type DexExecutionSequenceReport=Readonly<{
 status:
   | 'BLOCKED_BEFORE_CANARY'
   | 'READY_FOR_CONTROLLED_LIVE_CANARY'
   | 'CONTROLLED_LIVE_CANARY_CERTIFIED'
 stages:readonly DexExecutionStageEvidence[]
 ladder:DexExecutionLadderReport
 blockerCodes:readonly string[]
 realRuntimeStages:readonly DexExecutionStage[]
 controlledLiveCanaryAttempted:boolean
 unrestrictedLiveAuthorized:false
 authority:'CERTIFICATION_ORCHESTRATION_ONLY'
 canAuthorizeTrade:false
}>

const PRE_CANARY=Object.freeze([
 'HISTORICAL_REPLAY',
 'LIVE_SHADOW',
 'SIGNED_SIMULATION_NO_BROADCAST',
] as const)

function unique(values:readonly string[]):readonly string[]{
 return Object.freeze([...new Set(values)])
}

function assertIdentity(input:{
 evidence:DexExecutionStageEvidence
 runLineageId:string
 strategyId:string
 instrumentId:string
}):void{
 const {evidence}=input
 if(evidence.runLineageId!==input.runLineageId||evidence.strategyId!==input.strategyId||evidence.instrumentId!==input.instrumentId){
  throw new Error('DEX_SEQUENCE_STAGE_IDENTITY_MISMATCH:'+evidence.stage)
 }
}

function validateRunResult(result:DexStageRunResult,expectedStage:DexExecutionStage):void{
 if(result.evidence.stage!==expectedStage)throw new Error('DEX_SEQUENCE_STAGE_RESULT_MISMATCH:'+expectedStage)
 if(!result.runtimeEvidenceIds.length)throw new Error('DEX_SEQUENCE_RUNTIME_EVIDENCE_REQUIRED:'+expectedStage)
 const certification=certifyDexExecutionStage(result.evidence)
 if(!certification.passed)throw new Error('DEX_SEQUENCE_STAGE_FAILED:'+expectedStage+':'+certification.reasonCodes.join(','))
 if(result.runClass==='REAL_RUNTIME'&&!certification.operationalEvidence&&expectedStage!=='CONTROLLED_LIVE_CANARY'){
  throw new Error('DEX_SEQUENCE_REAL_RUNTIME_NOT_OPERATIONAL:'+expectedStage)
 }
}

export async function runDexExecutionSequence(input:{
 runLineageId:string
 strategyId:string
 instrumentId:string
 historicalReplay:DexStageExecutor
 liveShadow:DexStageExecutor
 signedSimulation:DexStageExecutor
 cofferCommission?:CofferCommissionFinalReport
 controlledLiveCanary?:DexControlledCanaryExecutor
}):Promise<DexExecutionSequenceReport>{
 if(!input.runLineageId.trim()||!input.strategyId.trim()||!input.instrumentId.trim())throw new Error('DEX_SEQUENCE_IDENTITY_REQUIRED')
 const executors=[input.historicalReplay,input.liveShadow,input.signedSimulation] as const
 for(let i=0;i<PRE_CANARY.length;i++){
  if(executors[i].stage!==PRE_CANARY[i])throw new Error('DEX_SEQUENCE_EXECUTOR_ORDER_INVALID:'+PRE_CANARY[i])
 }
 const stages:DexExecutionStageEvidence[]=[]
 const realRuntimeStages:DexExecutionStage[]=[]
 const blockers:string[]=[]

 for(let i=0;i<executors.length;i++){
  const expected=PRE_CANARY[i]!
  const result=await executors[i].run({
   priorStages:Object.freeze([...stages]),
   runLineageId:input.runLineageId,
   strategyId:input.strategyId,
   instrumentId:input.instrumentId,
  })
  validateRunResult(result,expected)
  assertIdentity({...input,evidence:result.evidence})
  const previous=stages.length?stages[stages.length-1]:undefined
  if(previous&&Date.parse(result.evidence.startedAt)<Date.parse(previous.endedAt))throw new Error('DEX_SEQUENCE_TIME_ORDER_INVALID:'+previous.stage+'->'+expected)
  if(result.runClass!=='REAL_RUNTIME')blockers.push('DEX_SEQUENCE_TEST_FIXTURE_ONLY:'+expected)
  else realRuntimeStages.push(expected)
  stages.push(result.evidence)
 }

 const firstThreeLadder=certifyDexExecutionLadder({stages})
 if(!firstThreeLadder.softwareCertified)blockers.push('DEX_SEQUENCE_PRE_CANARY_SOFTWARE_NOT_CERTIFIED')
 const firstThreeOperational=PRE_CANARY.every(stage=>realRuntimeStages.includes(stage))
 if(!firstThreeOperational)blockers.push('DEX_SEQUENCE_PRE_CANARY_REAL_RUNTIME_REQUIRED')

 const coffer=input.cofferCommission
 const cofferReady=Boolean(
  coffer?.passed===true&&
  coffer.status==='COFFER_COMMISSIONED'&&
  coffer.operationalEvidence===true&&
  coffer.unrestrictedLiveAuthorized===false,
 )
 if(!cofferReady)blockers.push('DEX_SEQUENCE_COFFER_COMMISSION_REQUIRED')
 if(!input.controlledLiveCanary)blockers.push('DEX_SEQUENCE_CONTROLLED_CANARY_EXECUTOR_REQUIRED')

 if(!firstThreeOperational||!cofferReady||!input.controlledLiveCanary){
  const uniqueBlockers=unique(blockers)
  return Object.freeze({
   status:firstThreeOperational&&cofferReady?'READY_FOR_CONTROLLED_LIVE_CANARY' as const:'BLOCKED_BEFORE_CANARY' as const,
   stages:Object.freeze([...stages]),
   ladder:firstThreeLadder,
   blockerCodes:uniqueBlockers,
   realRuntimeStages:Object.freeze([...realRuntimeStages]),
   controlledLiveCanaryAttempted:false,
   unrestrictedLiveAuthorized:false as const,
   authority:'CERTIFICATION_ORCHESTRATION_ONLY' as const,
   canAuthorizeTrade:false as const,
  })
 }

 const canary=await input.controlledLiveCanary.run({
  priorStages:Object.freeze([...stages]),
  runLineageId:input.runLineageId,
  strategyId:input.strategyId,
  instrumentId:input.instrumentId,
 })
 validateRunResult(canary,'CONTROLLED_LIVE_CANARY')
 assertIdentity({...input,evidence:canary.evidence})
 if(canary.runClass!=='REAL_RUNTIME')throw new Error('DEX_SEQUENCE_CANARY_REAL_RUNTIME_REQUIRED')
 if(Date.parse(canary.evidence.startedAt)<Date.parse(stages[stages.length-1]!.endedAt))throw new Error('DEX_SEQUENCE_TIME_ORDER_INVALID:SIGNED_SIMULATION_NO_BROADCAST->CONTROLLED_LIVE_CANARY')
 stages.push(canary.evidence)
 realRuntimeStages.push('CONTROLLED_LIVE_CANARY')
 const ladder=certifyDexExecutionLadder({stages,liveCanaryVerification:canary.verification})
 if(!ladder.controlledLiveCanaryCertified||!ladder.operationallyCertified||ladder.reasonCodes.length){
  throw new Error('DEX_SEQUENCE_CONTROLLED_CANARY_CERTIFICATION_FAILED:'+ladder.reasonCodes.join(','))
 }
 return Object.freeze({
  status:'CONTROLLED_LIVE_CANARY_CERTIFIED' as const,
  stages:Object.freeze([...stages]),
  ladder,
  blockerCodes:Object.freeze([]),
  realRuntimeStages:Object.freeze([...realRuntimeStages]),
  controlledLiveCanaryAttempted:true,
  unrestrictedLiveAuthorized:false as const,
  authority:'CERTIFICATION_ORCHESTRATION_ONLY' as const,
  canAuthorizeTrade:false as const,
 })
}
