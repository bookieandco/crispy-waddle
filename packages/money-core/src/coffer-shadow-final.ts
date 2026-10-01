import { createHash } from 'node:crypto'
import { certifyDexExecutionStage,type DexExecutionStageEvidence,type DexStageCertification,type Edge007IntegrityReceipt,type EdgeDecisionBundleReceipt } from './dex-four-stage-certification.js'
import { GovernedDexRouteRouter,type DexQuoteRequest,type DexRouteDecision } from './dex-route-router.js'

function hash(value:unknown):string{return createHash('sha256').update(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')}

export type CofferShadowRun=Readonly<{
 shadowRunId:string
 userId:string
 runLineageId:string
 strategyId:string
 instrumentId:string
 observedAt:string
 routeDecision:DexRouteDecision
 stageEvidence:DexExecutionStageEvidence
 certification:DexStageCertification
 signedTransactionCount:0
 broadcastCount:0
 financialAuthority:'NONE'
 authority:'COFFER_SHADOW_EVIDENCE_ONLY'
}>

export interface CofferShadowStore{
 put(run:CofferShadowRun):Promise<void>|void
 get(shadowRunId:string):Promise<CofferShadowRun|undefined>|CofferShadowRun|undefined
}

export class InMemoryCofferShadowStore implements CofferShadowStore{
 private readonly rows=new Map<string,CofferShadowRun>()
 put(run:CofferShadowRun):void{
  if(this.rows.has(run.shadowRunId))throw new Error('COFFER_SHADOW_DUPLICATE_RUN')
  this.rows.set(run.shadowRunId,run)
 }
 get(id:string):CofferShadowRun|undefined{return this.rows.get(id)}
}

export async function runCofferShadow(input:{
 router:GovernedDexRouteRouter
 store:CofferShadowStore
 userId:string
 runLineageId:string
 strategyId:string
 instrumentId:string
 request:DexQuoteRequest
 edgeDecisionBundle:EdgeDecisionBundleReceipt
 integrityGuard:Edge007IntegrityReceipt
 consecutiveRealizedLosses:number
 lossHaltActive?:boolean
 origin:'RECORDED_REAL_MARKET'|'LIVE_RUNTIME_ATTESTED'
}):Promise<CofferShadowRun>{
 for(const [value,code] of [
  [input.userId,'COFFER_SHADOW_USER_REQUIRED'],
  [input.runLineageId,'COFFER_SHADOW_LINEAGE_REQUIRED'],
  [input.strategyId,'COFFER_SHADOW_STRATEGY_REQUIRED'],
  [input.instrumentId,'COFFER_SHADOW_INSTRUMENT_REQUIRED'],
 ] as const)if(!value.trim())throw new Error(code)
 const routeDecision=await input.router.route({request:input.request,consecutiveRealizedLosses:input.consecutiveRealizedLosses,lossHaltActive:input.lossHaltActive})
 const selected=routeDecision.selected
 const evidenceIds=Object.freeze([...new Set([
  ...input.edgeDecisionBundle.evidenceIds,
  ...input.integrityGuard.evidenceIds,
  routeDecision.routeDecisionId,
  ...(selected?.evidenceIds??[]),
 ])])
 const stageEvidence:DexExecutionStageEvidence=Object.freeze({
  stageId:'coffer-shadow-stage:'+hash({runLineageId:input.runLineageId,routeDecisionId:routeDecision.routeDecisionId}),
  stage:'LIVE_SHADOW',
  origin:input.origin,
  runLineageId:input.runLineageId,
  strategyId:input.strategyId,
  instrumentId:input.instrumentId,
  startedAt:input.request.now,
  endedAt:input.request.now,
  informationCutoff:input.request.now,
  edgeDecisionBundle:input.edgeDecisionBundle,
  integrityGuard:input.integrityGuard,
  decisionCount:1,
  signedTransactionCount:0,
  simulationCount:0,
  simulationFailureCount:0,
  broadcastCount:0,
  entryBroadcastCount:0,
  exitBroadcastCount:0,
  reconciledBroadcastCount:0,
  duplicateBroadcastCount:0,
  unknownExecutionCount:selected?0:1,
  futureEvidenceCount:0,
  signerBoundary:'NOT_APPLICABLE',
  privateKeyMaterialObserved:false,
  capitalBounded:false,
  killSwitchProven:false,
  restartRecoveryProven:false,
  sellabilityProven:false,
  positionFlatAfterExit:false,
  executionCostReconciled:false,
  providerReceiptIds:Object.freeze([]),
  onchainSignatureIds:Object.freeze([]),
  evidenceIds,
 })
 const certification=certifyDexExecutionStage(stageEvidence)
 if(routeDecision.canSign!==false||routeDecision.canBroadcast!==false)throw new Error('COFFER_SHADOW_AUTHORITY_ESCALATION')
 const shadowRunId='coffer-shadow:'+hash({userId:input.userId,runLineageId:input.runLineageId,routeDecisionId:routeDecision.routeDecisionId,observedAt:input.request.now})
 const run=Object.freeze({
  shadowRunId,userId:input.userId,runLineageId:input.runLineageId,strategyId:input.strategyId,instrumentId:input.instrumentId,
  observedAt:input.request.now,routeDecision,stageEvidence,certification,
  signedTransactionCount:0 as const,broadcastCount:0 as const,financialAuthority:'NONE' as const,authority:'COFFER_SHADOW_EVIDENCE_ONLY' as const,
 })
 await input.store.put(run)
 return run
}

export type CofferShadowFinalReport=Readonly<{
 reportId:string
 passed:boolean
 routeSelected:boolean
 stageCertified:boolean
 zeroSigningProven:boolean
 zeroBroadcastProven:boolean
 reasonCodes:readonly string[]
 unrestrictedLiveAuthorized:false
 authority:'CERTIFICATION_ONLY'
}>

export function certifyCofferShadowFinal(run:CofferShadowRun):CofferShadowFinalReport{
 const reasons:string[]=[]
 if(run.authority!=='COFFER_SHADOW_EVIDENCE_ONLY'||run.financialAuthority!=='NONE')reasons.push('COFFER_SHADOW_AUTHORITY_INVALID')
 if(run.signedTransactionCount!==0||run.stageEvidence.signedTransactionCount!==0)reasons.push('COFFER_SHADOW_SIGNING_FORBIDDEN')
 if(run.broadcastCount!==0||run.stageEvidence.broadcastCount!==0)reasons.push('COFFER_SHADOW_BROADCAST_FORBIDDEN')
 if(!run.routeDecision.selected)reasons.push('COFFER_SHADOW_ADMISSIBLE_ROUTE_REQUIRED')
 if(!run.certification.passed)reasons.push(...run.certification.reasonCodes.map(x=>'COFFER_SHADOW_STAGE:'+x))
 const unique=Object.freeze([...new Set(reasons)])
 return Object.freeze({
  reportId:'coffer-shadow-final:'+hash({shadowRunId:run.shadowRunId,reasons:unique}),
  passed:unique.length===0,
  routeSelected:Boolean(run.routeDecision.selected),
  stageCertified:run.certification.passed,
  zeroSigningProven:run.signedTransactionCount===0&&run.stageEvidence.signedTransactionCount===0,
  zeroBroadcastProven:run.broadcastCount===0&&run.stageEvidence.broadcastCount===0,
  reasonCodes:unique,
  unrestrictedLiveAuthorized:false as const,
  authority:'CERTIFICATION_ONLY' as const,
 })
}
