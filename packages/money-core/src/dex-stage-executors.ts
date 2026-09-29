import { assertConnectorMayExecute } from './market-connector-contracts.js'
import { assertSignerLeaseMayPrepare } from './signer-lease-contracts.js'
import { assertSharkPreExecutionBinding, type SharkPreExecutionMaterial } from './shark-preexec-binding.js'
import { assertMoneyDexGatePassed, evaluateMoneyDexGate, type MoneyDexGateContext, type MoneyDexGatePolicy } from './money-dex-gate.js'
import {
 assertDexSwapIntent,
 type CofferSignerAdapter,
 type DexCommissioningBoundary,
 type DexSwapIntent,
 type ManagedSolanaDexAdapter,
 type SolanaChainObserver,
} from './solana-dex-runtime-contracts.js'
import type { DexExecutionStageEvidence } from './dex-four-stage-certification.js'
import type { DexStageExecutor, DexStageRunResult } from './dex-certification-runner.js'

export type RecordedMarketStageBatch=Readonly<{
 stage:'HISTORICAL_REPLAY'|'LIVE_SHADOW'
 startedAt:string
 endedAt:string
 informationCutoff:string
 decisionIds:readonly string[]
 futureEvidenceCount:number
 edgeDecisionBundle:DexExecutionStageEvidence['edgeDecisionBundle']
 integrityGuard:DexExecutionStageEvidence['integrityGuard']
 evidenceIds:readonly string[]
 source:'RECORDED_REAL_MARKET'
}>

export interface RecordedMarketStageSource{
 load(input:{
  stage:'HISTORICAL_REPLAY'|'LIVE_SHADOW'
  runLineageId:string
  strategyId:string
  instrumentId:string
 }):Promise<RecordedMarketStageBatch>
}

export class RecordedMarketDexStageExecutor implements DexStageExecutor{
 readonly stage:'HISTORICAL_REPLAY'|'LIVE_SHADOW'
 constructor(stage:'HISTORICAL_REPLAY'|'LIVE_SHADOW',private readonly source:RecordedMarketStageSource){this.stage=stage}
 async run(input:{priorStages:readonly DexExecutionStageEvidence[];runLineageId:string;strategyId:string;instrumentId:string}):Promise<DexStageRunResult>{
  const batch=await this.source.load({stage:this.stage,runLineageId:input.runLineageId,strategyId:input.strategyId,instrumentId:input.instrumentId})
  if(batch.stage!==this.stage||batch.source!=='RECORDED_REAL_MARKET')throw new Error('DEX_STAGE_RECORDED_SOURCE_INVALID:'+this.stage)
  if(!batch.decisionIds.length||!batch.evidenceIds.length)throw new Error('DEX_STAGE_RECORDED_EVIDENCE_REQUIRED:'+this.stage)
  if(batch.futureEvidenceCount!==0)throw new Error('DEX_STAGE_RECORDED_FUTURE_LEAKAGE:'+this.stage)
  if(Number.isNaN(Date.parse(batch.startedAt))||Number.isNaN(Date.parse(batch.endedAt))||Number.isNaN(Date.parse(batch.informationCutoff)))throw new Error('DEX_STAGE_RECORDED_TIME_INVALID:'+this.stage)
  const evidence:DexExecutionStageEvidence=Object.freeze({
   stageId:'dex-stage:'+this.stage+':'+input.runLineageId,
   stage:this.stage,
   origin:'RECORDED_REAL_MARKET',
   runLineageId:input.runLineageId,
   strategyId:input.strategyId,
   instrumentId:input.instrumentId,
   startedAt:batch.startedAt,
   endedAt:batch.endedAt,
   informationCutoff:batch.informationCutoff,
   edgeDecisionBundle:batch.edgeDecisionBundle,
   integrityGuard:batch.integrityGuard,
   decisionCount:batch.decisionIds.length,
   signedTransactionCount:0,
   simulationCount:0,
   simulationFailureCount:0,
   broadcastCount:0,
   entryBroadcastCount:0,
   exitBroadcastCount:0,
   reconciledBroadcastCount:0,
   duplicateBroadcastCount:0,
   unknownExecutionCount:0,
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
   evidenceIds:Object.freeze([...new Set([...batch.evidenceIds,...batch.decisionIds.map(id=>'decision:'+id)])]),
  })
  return Object.freeze({evidence,runClass:'REAL_RUNTIME' as const,runtimeEvidenceIds:Object.freeze([...batch.evidenceIds])})
 }
}

export type SignedSimulationExecutorOptions=Readonly<{
 intent:DexSwapIntent
 preExecutionMaterial:SharkPreExecutionMaterial
 boundary:DexCommissioningBoundary
 adapter:ManagedSolanaDexAdapter
 signer:CofferSignerAdapter
 chain:SolanaChainObserver
 dexGatePolicy:MoneyDexGatePolicy
 loadDexGateContext:(input:{now:string;intent:DexSwapIntent})=>Promise<MoneyDexGateContext>|MoneyDexGateContext
 now:()=>string
 stageId?:string
}>

export class SignedNoBroadcastDexStageExecutor implements DexStageExecutor{
 readonly stage='SIGNED_SIMULATION_NO_BROADCAST' as const
 constructor(private readonly options:SignedSimulationExecutorOptions){}
 async run(input:{priorStages:readonly DexExecutionStageEvidence[];runLineageId:string;strategyId:string;instrumentId:string}):Promise<DexStageRunResult>{
  const {intent,boundary,adapter,signer,chain}=this.options
  if(intent.runLineageId!==input.runLineageId||intent.strategyId!==input.strategyId||intent.instrumentId!==input.instrumentId)throw new Error('DEX_SIGNED_SIMULATION_LINEAGE_MISMATCH')
  assertDexSwapIntent(intent)
  assertSharkPreExecutionBinding({binding:intent.preExecution,material:this.options.preExecutionMaterial,informationCutoff:intent.informationCutoff})
  assertConnectorMayExecute(boundary.connector)
  if(boundary.connector.lane!=='DEX'||boundary.connector.admission!=='CONTROLLED_CANARY')throw new Error('DEX_SIGNED_SIMULATION_CONNECTOR_ADMISSION_REQUIRED')
  if(boundary.connector.provider!==adapter.provider||intent.provider!==adapter.provider)throw new Error('DEX_SIGNED_SIMULATION_PROVIDER_BINDING_MISMATCH')
  if(boundary.wallet.connectionId!==intent.walletConnectionId||boundary.wallet.userId!==intent.userId||boundary.wallet.mode!=='COFFER_EXECUTION_WALLET'||boundary.wallet.network!=='SOLANA')throw new Error('DEX_SIGNED_SIMULATION_COFFER_REQUIRED')
  if(boundary.signerLease.leaseId!==intent.signerLeaseId||boundary.signerLease.state!=='ACTIVE'||boundary.signerLease.containsPrivateKey||boundary.signerLease.containsRawToken)throw new Error('DEX_SIGNED_SIMULATION_SIGNER_LEASE_REQUIRED')
  const startedAt=this.options.now()
  assertSignerLeaseMayPrepare({
   policy:boundary.signerPolicy,
   lease:boundary.signerLease,
   observation:boundary.signerObservation,
   intent:{amountMinor:intent.notionalMinor,assetId:intent.inputMint,destinationAddress:boundary.wallet.address,now:startedAt},
  })
  const order=await adapter.createOrder({intent,takerAddress:boundary.wallet.address})
  if(order.inputMint!==intent.inputMint||order.outputMint!==intent.outputMint||order.inputAmountAtomic!==intent.inputAmountAtomic||order.takerAddress!==boundary.wallet.address)throw new Error('DEX_SIGNED_SIMULATION_ORDER_BINDING_MISMATCH')
  if(adapter.provider!=='solana-dex-router'&&order.provider!==adapter.provider)throw new Error('DEX_SIGNED_SIMULATION_ROUTE_PROVIDER_MISMATCH')
  const unsignedSimulation=await chain.simulateUnsignedTransaction({unsignedTransactionBase64:order.unsignedTransactionBase64,now:startedAt})
  if(!unsignedSimulation.passed)throw new Error('DEX_SIGNED_SIMULATION_UNSIGNED_PREFLIGHT_FAILED')
  const gateContext=await this.options.loadDexGateContext({now:startedAt,intent})
  if(gateContext.now!==startedAt)throw new Error('DEX_SIGNED_SIMULATION_GATE_TIME_MISMATCH')
  const gate=evaluateMoneyDexGate({intent,order,policy:this.options.dexGatePolicy,context:gateContext})
  assertMoneyDexGatePassed(gate)
  const signed=await signer.signVersionedTransaction({
   walletConnectionId:intent.walletConnectionId,
   signerLeaseId:intent.signerLeaseId,
   unsignedTransactionBase64:order.unsignedTransactionBase64,
   idempotencyKey:'signed-simulation:'+intent.idempotencyKey,
   expectedSignerAddress:boundary.wallet.address,
   now:startedAt,
  })
  if(signed.walletConnectionId!==intent.walletConnectionId||signed.signerLeaseId!==intent.signerLeaseId||signed.signerAddress!==boundary.wallet.address||signed.containsPrivateKey!==false||signed.containsRawToken!==false)throw new Error('DEX_SIGNED_SIMULATION_SIGNER_OUTPUT_INVALID')
  const signedSimulation=await chain.simulateSignedTransaction({signedTransactionBase64:signed.signedTransactionBase64,primarySignature:signed.primarySignature,now:startedAt})
  if(!signedSimulation.passed)throw new Error('DEX_SIGNED_SIMULATION_FAILED')
  const endedAt=this.options.now()
  const evidenceIds=Object.freeze([...new Set([
   ...intent.evidenceIds,
   ...intent.preExecution.evidenceIds,
   ...order.evidenceIds,
   ...unsignedSimulation.evidenceIds,
   ...gate.evidenceIds,
   gate.gateId,
   ...signed.evidenceIds,
   ...signedSimulation.evidenceIds,
  ])])
  const evidence:DexExecutionStageEvidence=Object.freeze({
   stageId:this.options.stageId??'dex-stage:SIGNED_SIMULATION_NO_BROADCAST:'+input.runLineageId,
   stage:'SIGNED_SIMULATION_NO_BROADCAST',
   origin:'LIVE_RUNTIME_ATTESTED',
   runLineageId:input.runLineageId,
   strategyId:input.strategyId,
   instrumentId:input.instrumentId,
   walletConnectionId:intent.walletConnectionId,
   startedAt,
   endedAt,
   informationCutoff:intent.informationCutoff,
   edgeDecisionBundle:this.options.preExecutionMaterial.edgeDecisionBundle,
   integrityGuard:this.options.preExecutionMaterial.integrityGuard,
   decisionCount:1,
   signedTransactionCount:1,
   simulationCount:2,
   simulationFailureCount:0,
   broadcastCount:0,
   entryBroadcastCount:0,
   exitBroadcastCount:0,
   reconciledBroadcastCount:0,
   duplicateBroadcastCount:0,
   unknownExecutionCount:0,
   futureEvidenceCount:0,
   signerBoundary:'ISOLATED',
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
  return Object.freeze({evidence,runClass:'REAL_RUNTIME' as const,runtimeEvidenceIds:evidenceIds})
 }
}
