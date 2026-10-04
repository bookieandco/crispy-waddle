import {assertConnectorMayExecute} from './market-connector-contracts.js'
import {assertSignerLeaseMayPrepare} from './signer-lease-contracts.js'
import {
  assertDexSwapIntent,
  hashDexRuntime,
  type CofferSignerAdapter,
  type DexCommissioningBoundary,
  type DexExecutionAttempt,
  type DexExecutionAttemptStore,
  type DexExecutionEventSink,
  type DexSimulationReceipt,
  type DexSwapIntent,
  type DexUnsignedSimulationReceipt,
  type ManagedSolanaDexAdapter,
  type SolanaChainObserver,
} from './solana-dex-runtime-contracts.js'
export const DEX_SIGNED_SIMULATION_NO_BROADCAST_EVIDENCE='dex:stage3:signed-simulation-no-broadcast' as const

import {
  certifyDexExecutionStage,
  type DexExecutionStageEvidence,
  type DexStageCertification,
  type Edge007IntegrityReceipt,
  type EdgeDecisionBundleReceipt,
} from './dex-four-stage-certification.js'

export type DexSignedSimulationNoBroadcastResult=Readonly<{
  attempt:DexExecutionAttempt
  preflightSimulation:DexUnsignedSimulationReceipt
  simulation:DexSimulationReceipt
  stageEvidence:DexExecutionStageEvidence
  certification:DexStageCertification
  providerSubmissionAttempted:false
  broadcastCount:0
  canBroadcast:false
  authority:'COMMISSIONING_EVIDENCE_ONLY'
}>

async function emit(
  sink:DexExecutionEventSink,
  intent:DexSwapIntent,
  type:'TX_SIMULATED'|'TX_SIGNED',
  now:string,
  evidenceIds:readonly string[],
  details:Readonly<Record<string,unknown>>,
):Promise<void>{
  await sink.publish(Object.freeze({
    type,
    tradeId:intent.tradeId,
    executionId:intent.executionId,
    runLineageId:intent.runLineageId,
    strategyId:intent.strategyId,
    instrumentId:intent.instrumentId,
    leg:intent.leg,
    occurredAt:now,
    evidenceIds:Object.freeze([...new Set(evidenceIds)]),
    details:Object.freeze({...details}),
    authority:'EXECUTION_TELEMETRY_ONLY' as const,
  }))
}

function assertSimulationBoundary(input:{
  intent:DexSwapIntent
  boundary:DexCommissioningBoundary
  adapter:ManagedSolanaDexAdapter
  now:string
}):void{
  const {intent,boundary,adapter,now}=input
  assertDexSwapIntent(intent)
  if(now<intent.approval.approvedAt)throw new Error('DEX_SIGNED_SIMULATION_BEFORE_APPROVAL')
  const {connector,wallet,signerPolicy,signerLease,signerObservation}=boundary
  assertConnectorMayExecute(connector)
  if(connector.lane!=='DEX'||connector.admission!=='CONTROLLED_CANARY')throw new Error('DEX_SIGNED_SIMULATION_CONTROLLED_CANARY_ADMISSION_REQUIRED')
  if(connector.provider!==adapter.provider||connector.provider!==intent.provider)throw new Error('DEX_SIGNED_SIMULATION_PROVIDER_BINDING_MISMATCH')
  if(!connector.credentialRef?.trim()||!connector.evidenceIds.length)throw new Error('DEX_SIGNED_SIMULATION_PROVIDER_EVIDENCE_REQUIRED')
  if(wallet.connectionId!==intent.walletConnectionId||wallet.userId!==intent.userId||wallet.network!=='SOLANA'||wallet.mode!=='COFFER_EXECUTION_WALLET')throw new Error('DEX_SIGNED_SIMULATION_WALLET_BINDING_REQUIRED')
  if(wallet.canSign!==false||wallet.authority!=='CONNECTION_ONLY'||!wallet.evidenceIds.length)throw new Error('DEX_SIGNED_SIMULATION_WALLET_METADATA_INVALID')
  if(signerLease.leaseId!==intent.signerLeaseId)throw new Error('DEX_SIGNED_SIMULATION_SIGNER_LEASE_BINDING_MISMATCH')
  if(!signerPolicy.allowedAssets.includes(intent.inputMint)||!signerPolicy.allowedAssets.includes(intent.outputMint))throw new Error('DEX_SIGNED_SIMULATION_SIGNER_MINT_BLOCKED')
  assertSignerLeaseMayPrepare({
    policy:signerPolicy,
    lease:signerLease,
    observation:signerObservation,
    intent:{
      amountMinor:intent.notionalMinor,
      assetId:intent.inputMint,
      destinationAddress:wallet.address,
      now,
    },
  })
}

export async function runSignedDexSimulationNoBroadcast(input:{
  intent:DexSwapIntent
  boundary:DexCommissioningBoundary
  adapter:ManagedSolanaDexAdapter
  signer:CofferSignerAdapter
  chain:SolanaChainObserver
  events:DexExecutionEventSink
  attemptStore:DexExecutionAttemptStore
  edgeDecisionBundle:EdgeDecisionBundleReceipt
  integrityGuard:Edge007IntegrityReceipt
  attemptId:string
  now:string
}):Promise<DexSignedSimulationNoBroadcastResult>{
  const {intent,boundary,adapter,signer,chain,events,attemptStore,edgeDecisionBundle,integrityGuard,attemptId,now}=input
  if(!attemptId.trim())throw new Error('DEX_SIGNED_SIMULATION_ATTEMPT_ID_REQUIRED')
  if(Number.isNaN(Date.parse(now)))throw new Error('DEX_SIGNED_SIMULATION_TIME_INVALID')
  assertSimulationBoundary({intent,boundary,adapter,now})
  if(hashDexRuntime(edgeDecisionBundle)!==intent.approval.edgeDecisionBundleHash)throw new Error('DEX_SIGNED_SIMULATION_EDGE_BINDING_MISMATCH')
  if(hashDexRuntime(integrityGuard)!==intent.approval.integrityGuardHash)throw new Error('DEX_SIGNED_SIMULATION_INTEGRITY_BINDING_MISMATCH')
  if(await attemptStore.getByIdempotencyKey(intent.idempotencyKey))throw new Error('DEX_SIGNED_SIMULATION_DUPLICATE_EXECUTION_BLOCKED')

  const order=await adapter.createOrder({intent,takerAddress:boundary.wallet.address})
  if(
    order.authority!=='PROVIDER_QUOTE_ONLY'||
    order.canBroadcast!==false||
    !order.requestId.trim()||
    order.provider!==intent.provider||
    order.inputMint!==intent.inputMint||
    order.outputMint!==intent.outputMint||
    order.inputAmountAtomic!==intent.inputAmountAtomic||
    order.takerAddress!==boundary.wallet.address
  )throw new Error('DEX_SIGNED_SIMULATION_ORDER_BINDING_MISMATCH')
  if(order.quotedOutputAtomic<intent.minimumOutputAtomic)throw new Error('DEX_SIGNED_SIMULATION_QUOTE_BELOW_MINIMUM')

  const preflightSimulation=await chain.simulateUnsignedTransaction({
    unsignedTransactionBase64:order.unsignedTransactionBase64,
    now,
  })
  if(!preflightSimulation.passed)throw new Error('DEX_SIGNED_SIMULATION_UNSIGNED_PREFLIGHT_FAILED')
  await emit(events,intent,'TX_SIMULATED',now,[...intent.evidenceIds,...order.evidenceIds,...preflightSimulation.evidenceIds],{
    simulationId:preflightSimulation.simulationId,
    providerRequestId:order.requestId,
    stage:'UNSIGNED_PREFLIGHT',
    canBroadcast:false,
  })

  const signed=await signer.signVersionedTransaction({
    walletConnectionId:intent.walletConnectionId,
    signerLeaseId:intent.signerLeaseId,
    unsignedTransactionBase64:order.unsignedTransactionBase64,
    idempotencyKey:intent.idempotencyKey,
    expectedSignerAddress:boundary.wallet.address,
    now,
  })
  if(
    signed.walletConnectionId!==intent.walletConnectionId||
    signed.signerLeaseId!==intent.signerLeaseId||
    signed.signerAddress!==boundary.wallet.address||
    signed.authority!=='SIGNER_OUTPUT_ONLY'||
    signed.containsPrivateKey!==false||
    signed.containsRawToken!==false||
    !signed.primarySignature.trim()||
    !signed.signedTransactionHash.trim()
  )throw new Error('DEX_SIGNED_SIMULATION_SIGNER_OUTPUT_INVALID')

  let attempt:DexExecutionAttempt=Object.freeze({
    attemptId,
    executionId:intent.executionId,
    requestId:intent.requestId,
    runLineageId:intent.runLineageId,
    leg:intent.leg,
    provider:intent.provider,
    walletConnectionId:intent.walletConnectionId,
    signerLeaseId:intent.signerLeaseId,
    idempotencyKey:intent.idempotencyKey,
    inputMint:intent.inputMint,
    outputMint:intent.outputMint,
    inputAmountAtomic:intent.inputAmountAtomic,
    minimumOutputAtomic:intent.minimumOutputAtomic,
    signedTransactionHash:signed.signedTransactionHash,
    primarySignature:signed.primarySignature,
    providerRequestId:order.requestId,
    state:'SIGNED',
    startedAt:now,
    updatedAt:now,
    evidenceIds:Object.freeze([...new Set([...intent.evidenceIds,...order.evidenceIds,...preflightSimulation.evidenceIds,...signed.evidenceIds])]),
    authority:'EXECUTION_ATTEMPT_ONLY' as const,
  })
  await attemptStore.put(attempt)
  try{
    await emit(events,intent,'TX_SIGNED',now,attempt.evidenceIds,{
      primarySignature:signed.primarySignature,
      signedTransactionHash:signed.signedTransactionHash,
      stage:'SIGNED_SIMULATION_NO_BROADCAST',
      canBroadcast:false,
    })
  }catch(error){
    await attemptStore.update(attemptId,{state:'FAILED',errorCode:'DEX_SIGNED_SIMULATION_EVENT_PUBLISH_FAILED',updatedAt:now})
    throw error
  }

  const simulation=await chain.simulateSignedTransaction({
    signedTransactionBase64:signed.signedTransactionBase64,
    primarySignature:signed.primarySignature,
    now,
  })
  if(!simulation.passed){
    await attemptStore.update(attemptId,{
      state:'FAILED',
      errorCode:simulation.errorCode??'DEX_SIGNED_SIMULATION_FAILED',
      updatedAt:now,
      evidenceIds:[...attempt.evidenceIds,...simulation.evidenceIds,DEX_SIGNED_SIMULATION_NO_BROADCAST_EVIDENCE],
    })
    throw new Error('DEX_SIGNED_SIMULATION_FAILED')
  }
  attempt=await attemptStore.update(attemptId,{
    state:'SIMULATED',
    simulationId:simulation.simulationId,
    simulatedFeeLamports:simulation.feeLamports,
    updatedAt:now,
    evidenceIds:[...attempt.evidenceIds,...simulation.evidenceIds,DEX_SIGNED_SIMULATION_NO_BROADCAST_EVIDENCE],
  })
  await emit(events,intent,'TX_SIMULATED',now,attempt.evidenceIds,{
    simulationId:simulation.simulationId,
    feeLamports:simulation.feeLamports?.toString(),
    stage:'SIGNED_SIMULATION_NO_BROADCAST',
    canBroadcast:false,
  })

  const stageEvidence:DexExecutionStageEvidence=Object.freeze({
    stageId:'dex:signed-simulation:'+hashDexRuntime({
      attemptId:attempt.attemptId,
      executionId:attempt.executionId,
      simulationId:attempt.simulationId,
      signedTransactionHash:attempt.signedTransactionHash,
    }),
    stage:'SIGNED_SIMULATION_NO_BROADCAST',
    origin:'LIVE_RUNTIME_ATTESTED',
    runLineageId:intent.runLineageId,
    strategyId:intent.strategyId,
    instrumentId:intent.instrumentId,
    walletConnectionId:intent.walletConnectionId,
    startedAt:now,
    endedAt:now,
    informationCutoff:intent.informationCutoff,
    edgeDecisionBundle,
    integrityGuard,
    decisionCount:1,
    signedTransactionCount:1,
    simulationCount:1,
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
    evidenceIds:Object.freeze([...new Set([
      ...attempt.evidenceIds,
      ...edgeDecisionBundle.evidenceIds,
      ...integrityGuard.evidenceIds,
      preflightSimulation.simulationId,
      simulation.simulationId,
    ])]),
  })
  const certification=certifyDexExecutionStage(stageEvidence)
  if(!certification.passed||!certification.operationalEvidence)throw new Error('DEX_SIGNED_SIMULATION_CERTIFICATION_FAILED:'+certification.reasonCodes.join(','))

  return Object.freeze({
    attempt,
    preflightSimulation,
    simulation,
    stageEvidence,
    certification,
    providerSubmissionAttempted:false as const,
    broadcastCount:0 as const,
    canBroadcast:false as const,
    authority:'COMMISSIONING_EVIDENCE_ONLY' as const,
  })
}
