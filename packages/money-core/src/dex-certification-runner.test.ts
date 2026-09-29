import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import {
 dexLiveCanaryEvidenceHash,
 type DexExecutionStage,
 type DexExecutionStageEvidence,
 type DexLiveCanaryVerificationReceipt,
 type Edge007IntegrityReceipt,
 type EdgeDecisionBundleReceipt,
} from './dex-four-stage-certification.js'
import { runDexExecutionSequence,type DexStageExecutor,type DexControlledCanaryExecutor } from './dex-certification-runner.js'
import type { CofferCommissionFinalReport } from './coffer-commission-final.js'
import type { DexRouterFinalReport } from './dex-router-final.js'

const edgeDecisionBundle:EdgeDecisionBundleReceipt={
 frameworkVersion:'EDGE-001-006-v1',
 receipts:(['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const).map(gateId=>({
  gateId,version:'EDGE-001-006-v1',disposition:'PASS',reasonCodes:[],evidenceIds:['e:'+gateId],evaluatedAt:'2026-09-27T18:00:00Z',authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false,
 })),
 disposition:'PASS',reasonCodes:[],evidenceIds:['edge-bundle:e'],authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false,
}
const integrity:Edge007IntegrityReceipt={guardVersion:'EDGE-007-v1',guardId:'edge007:1',disposition:'PASS',reasonCodes:[],evidenceIds:['edge007:e'],authority:'INTEGRITY_VETO_ONLY',canAuthorizeTrade:false,canAuthorizePromotion:false}
const windows:Record<DexExecutionStage,readonly [string,string]>={
 HISTORICAL_REPLAY:['2026-09-27T19:00:00Z','2026-09-27T19:05:00Z'],
 LIVE_SHADOW:['2026-09-27T19:06:00Z','2026-09-27T19:11:00Z'],
 SIGNED_SIMULATION_NO_BROADCAST:['2026-09-27T19:12:00Z','2026-09-27T19:17:00Z'],
 CONTROLLED_LIVE_CANARY:['2026-09-27T19:18:00Z','2026-09-27T19:23:00Z'],
}
function evidence(stage:DexExecutionStage):DexExecutionStageEvidence{
 const [startedAt,endedAt]=windows[stage]
 const base:DexExecutionStageEvidence={
  stageId:'runner:'+stage,stage,origin:stage==='CONTROLLED_LIVE_CANARY'||stage==='SIGNED_SIMULATION_NO_BROADCAST'?'LIVE_RUNTIME_ATTESTED':'RECORDED_REAL_MARKET',
  runLineageId:'lineage:runner:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN',
  startedAt,endedAt,informationCutoff:endedAt,edgeDecisionBundle,integrityGuard:integrity,decisionCount:1,
  signedTransactionCount:0,simulationCount:0,simulationFailureCount:0,broadcastCount:0,entryBroadcastCount:0,exitBroadcastCount:0,reconciledBroadcastCount:0,
  duplicateBroadcastCount:0,unknownExecutionCount:0,futureEvidenceCount:0,signerBoundary:'NOT_APPLICABLE',privateKeyMaterialObserved:false,
  capitalBounded:false,killSwitchProven:false,restartRecoveryProven:false,sellabilityProven:false,positionFlatAfterExit:false,executionCostReconciled:false,
  providerReceiptIds:[],onchainSignatureIds:[],evidenceIds:['runner:e:'+stage],
 }
 if(stage==='SIGNED_SIMULATION_NO_BROADCAST')return {...base,walletConnectionId:'coffer:1',signedTransactionCount:1,simulationCount:1,signerBoundary:'ISOLATED'}
 if(stage==='CONTROLLED_LIVE_CANARY')return {
  ...base,walletConnectionId:'coffer:1',entryExecutionId:'exec:entry',exitExecutionId:'exec:exit',signedTransactionCount:2,simulationCount:2,broadcastCount:2,
  entryBroadcastCount:1,exitBroadcastCount:1,reconciledBroadcastCount:2,signerBoundary:'ISOLATED',capitalBounded:true,killSwitchProven:true,restartRecoveryProven:true,
  sellabilityProven:true,positionFlatAfterExit:true,executionCostReconciled:true,providerReceiptIds:['provider:entry','provider:exit'],onchainSignatureIds:['sig:entry','sig:exit'],
 }
 return base
}
function executor(stage:DexExecutionStage,runClass:'REAL_RUNTIME'|'TEST_FIXTURE'='REAL_RUNTIME'):DexStageExecutor{
 return {stage,run:async()=>({evidence:evidence(stage),runClass,runtimeEvidenceIds:['runtime:'+stage]})}
}
const coffer:CofferCommissionFinalReport={
 reportId:'coffer:live',version:'COFFER-COMMISSION-v1',status:'COFFER_COMMISSIONED',passed:true,softwareReady:true,operationalEvidence:true,
 walletConnectionId:'coffer:1',walletAddress:'Wallet111',observedBalanceLamports:1_000_000n,requiredBalanceLamports:100_000n,fundingShortfallLamports:0n,
 settlementAssetId:'USDC_MINT',observedSettlementAtomic:1_000_000n,requiredSettlementAtomic:500_000n,settlementShortfallAtomic:0n,settlementFundingVerified:true,
 blockerCodes:[],evidenceIds:['coffer:e'],unrestrictedLiveAuthorized:false,authority:'CERTIFICATION_ONLY',canMoveFunds:false,
}

const router:DexRouterFinalReport={
 reportId:'router:live',version:'DEX-ROUTER-FINAL-v1',status:'DEX_ROUTER_COMMISSIONED',passed:true,
 jupiterPrimaryVerified:true,raydiumDirectVerified:true,meteoraDirectVerified:true,
 fallbackOrder:['jupiter-ultra','raydium-direct','meteora-direct'],blockerCodes:[],evidenceIds:['router:e'],
 unrestrictedLiveAuthorized:false,authority:'CERTIFICATION_ONLY',canAuthorizeTrade:false,
}
function canaryExecutor():DexControlledCanaryExecutor{
 return {stage:'CONTROLLED_LIVE_CANARY',run:async()=>{
  const e=evidence('CONTROLLED_LIVE_CANARY')
  const verification:DexLiveCanaryVerificationReceipt={
   verificationId:'verify:1',stageId:e.stageId,runLineageId:e.runLineageId,walletConnectionId:e.walletConnectionId!,entryExecutionId:e.entryExecutionId!,exitExecutionId:e.exitExecutionId!,
   stageEvidenceHash:dexLiveCanaryEvidenceHash(e),verifiedAt:'2026-09-27T19:24:00Z',providerReceiptIds:e.providerReceiptIds,onchainSignatureIds:e.onchainSignatureIds,
   providerEvidenceVerified:true,onchainEvidenceVerified:true,source:'COMMISSIONED_DEX_RUNTIME',authority:'RUNTIME_EVIDENCE_ONLY',
  }
  return {evidence:e,runClass:'REAL_RUNTIME',runtimeEvidenceIds:['runtime:canary'],verification}
 }}
}

describe('DEX execution sequence runner',()=>{
 it('runs replay -> shadow, then stops before signer access when router/Coffer are not commissioned',async()=>{
  const calls:DexExecutionStage[]=[]
  const wrap=(stage:DexExecutionStage):DexStageExecutor=>({stage,run:async()=>{calls.push(stage);return {evidence:evidence(stage),runClass:'REAL_RUNTIME',runtimeEvidenceIds:['runtime:'+stage]}}})
  const report=await runDexExecutionSequence({
   runLineageId:'lineage:runner:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN',
   historicalReplay:wrap('HISTORICAL_REPLAY'),liveShadow:wrap('LIVE_SHADOW'),signedSimulation:wrap('SIGNED_SIMULATION_NO_BROADCAST'),
  })
  assert.deepEqual(calls,['HISTORICAL_REPLAY','LIVE_SHADOW'])
  assert.equal(report.status,'BLOCKED_BEFORE_CANARY')
  assert.equal(report.controlledLiveCanaryAttempted,false)
  assert.ok(report.blockerCodes.includes('DEX_SEQUENCE_ROUTER_COMMISSION_REQUIRED'))
  assert.ok(report.blockerCodes.includes('DEX_SEQUENCE_COFFER_COMMISSION_REQUIRED'))
  assert.equal(report.unrestrictedLiveAuthorized,false)
 })
 it('does not let test fixtures masquerade as operational reruns',async()=>{
  const report=await runDexExecutionSequence({
   runLineageId:'lineage:runner:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN',
   historicalReplay:executor('HISTORICAL_REPLAY','TEST_FIXTURE'),liveShadow:executor('LIVE_SHADOW'),signedSimulation:executor('SIGNED_SIMULATION_NO_BROADCAST'),
   routerCommission:router,cofferCommission:coffer,controlledLiveCanary:canaryExecutor(),
  })
  assert.equal(report.status,'BLOCKED_BEFORE_CANARY')
  assert.equal(report.controlledLiveCanaryAttempted,false)
  assert.ok(report.blockerCodes.includes('DEX_SEQUENCE_TEST_FIXTURE_ONLY:HISTORICAL_REPLAY'))
  assert.ok(report.blockerCodes.includes('DEX_SEQUENCE_PRE_CANARY_REAL_RUNTIME_REQUIRED'))
 })
 it('runs the real controlled canary only after all three real stages and Coffer commissioning pass',async()=>{
  const report=await runDexExecutionSequence({
   runLineageId:'lineage:runner:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN',
   historicalReplay:executor('HISTORICAL_REPLAY'),liveShadow:executor('LIVE_SHADOW'),signedSimulation:executor('SIGNED_SIMULATION_NO_BROADCAST'),
   routerCommission:router,cofferCommission:coffer,controlledLiveCanary:canaryExecutor(),
  })
  assert.equal(report.status,'CONTROLLED_LIVE_CANARY_CERTIFIED')
  assert.equal(report.controlledLiveCanaryAttempted,true)
  assert.equal(report.ladder.operationallyCertified,true)
  assert.equal(report.ladder.controlledLiveCanaryCertified,true)
  assert.deepEqual(report.realRuntimeStages,['HISTORICAL_REPLAY','LIVE_SHADOW','SIGNED_SIMULATION_NO_BROADCAST','CONTROLLED_LIVE_CANARY'])
  assert.equal(report.unrestrictedLiveAuthorized,false)
 })
})
