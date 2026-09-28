import type { PermitStore } from './execution-permit.js'
import { activateLiveKillSwitch, type LiveCanaryPolicy, type LiveCanaryStateStore } from './live-canary-contracts.js'
import type { MoneyMarketConnectorDescriptor } from './market-connector-contracts.js'
import type { ConnectedWallet } from './wallet-connector-contracts.js'
import type { SignerLease, SignerLeasePolicy } from './signer-lease-contracts.js'
import {
 assertDexControlledLiveCanaryCertified,
 certifyDexExecutionLadder,
 dexLiveCanaryEvidenceHash,
 type DexExecutionLadderReport,
 type DexExecutionStageEvidence,
 type DexLiveCanaryVerificationReceipt,
 type Edge007IntegrityReceipt,
} from './dex-four-stage-certification.js'
import type { DexCanaryReconcileResult, DexCanarySubmitResult, DexRestartRecoveryProof } from './dex-controlled-canary-runtime.js'
import { hashDexRuntime, type DexSwapIntent } from './solana-dex-runtime-contracts.js'

export type DexCapitalBoundaryProof=Readonly<{
 proofId:string
 walletConnectionId:string
 provider:'jupiter-ultra'
 entryExecutionId:string
 exitExecutionId:string
 maxOrderNotionalMinor:bigint
 maxDailySubmittedNotionalMinor:bigint
 signerPerTransactionCapMinor:bigint
 signerRolling24hCapMinor:bigint
 passed:true
 evidenceIds:readonly string[]
 authority:'CAPITAL_BOUNDARY_EVIDENCE_ONLY'
}>

export type DexKillSwitchProof=Readonly<{
 proofId:string
 provider:'jupiter-ultra'
 walletConnectionId:string
 tradingDate:string
 activatedAt:string
 reserveBlockedAfterHalt:true
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 authority:'EMERGENCY_STOP_EVIDENCE_ONLY'
}>

export type DexCommissionFinalReport=Readonly<{
 reportId:string
 status:'SOFTWARE_READY_RUNTIME_CANARY_REQUIRED'|'CONTROLLED_CANARY_CERTIFIED'
 passed:boolean
 stageReport?:DexExecutionLadderReport
 blockerCodes:readonly string[]
 softwareReady:true
 controlledLiveCanaryCertified:boolean
 unrestrictedLiveAuthorized:false
 authority:'CERTIFICATION_ONLY'
}>

function unique(values:readonly string[]):readonly string[]{return Object.freeze([...new Set(values)])}

export function proveDexCapitalBoundary(input:{
 connector:MoneyMarketConnectorDescriptor
 signerPolicy:SignerLeasePolicy
 canaryPolicy:LiveCanaryPolicy
 entryIntent:DexSwapIntent
 exitIntent:DexSwapIntent
 evidenceIds:readonly string[]
}):DexCapitalBoundaryProof{
 const {connector,signerPolicy,canaryPolicy,entryIntent,exitIntent}=input
 if(connector.provider!=='jupiter-ultra'||connector.lane!=='DEX'||connector.admission!=='CONTROLLED_CANARY')throw new Error('DEX_COMMISSION_CAPITAL_CONNECTOR_INVALID')
 if(entryIntent.walletConnectionId!==exitIntent.walletConnectionId||entryIntent.runLineageId!==exitIntent.runLineageId)throw new Error('DEX_COMMISSION_CAPITAL_LINEAGE_MISMATCH')
 if(entryIntent.leg!=='ENTRY'||exitIntent.leg!=='EXIT')throw new Error('DEX_COMMISSION_CAPITAL_LEG_INVALID')
 if(entryIntent.executionId===exitIntent.executionId)throw new Error('DEX_COMMISSION_CAPITAL_EXECUTION_IDS_MUST_DIFFER')
 if(canaryPolicy.maxDailyOrders<2)throw new Error('DEX_COMMISSION_CAPITAL_TWO_ORDERS_REQUIRED')
 if(canaryPolicy.maxOrderNotionalMinor<=0n||canaryPolicy.maxDailySubmittedNotionalMinor<=0n)throw new Error('DEX_COMMISSION_CAPITAL_POLICY_INVALID')
 if(signerPolicy.perTransactionCapMinor<=0n||signerPolicy.rolling24hCapMinor<=0n)throw new Error('DEX_COMMISSION_SIGNER_CAP_INVALID')
 for(const intent of [entryIntent,exitIntent]){
  if(intent.notionalMinor>canaryPolicy.maxOrderNotionalMinor||intent.notionalMinor>signerPolicy.perTransactionCapMinor)throw new Error('DEX_COMMISSION_CAPITAL_PER_ORDER_EXCEEDED')
  if(!signerPolicy.allowedAssets.includes(intent.inputMint)||!signerPolicy.allowedAssets.includes(intent.outputMint))throw new Error('DEX_COMMISSION_CAPITAL_ASSET_NOT_ALLOWED')
 }
 const total=entryIntent.notionalMinor+exitIntent.notionalMinor
 if(total>canaryPolicy.maxDailySubmittedNotionalMinor||total>signerPolicy.rolling24hCapMinor)throw new Error('DEX_COMMISSION_CAPITAL_DAILY_CAP_EXCEEDED')
 if(!input.evidenceIds.length)throw new Error('DEX_COMMISSION_CAPITAL_EVIDENCE_REQUIRED')
 return Object.freeze({
  proofId:'dex:capital:'+hashDexRuntime({
   walletConnectionId:entryIntent.walletConnectionId,
   entryExecutionId:entryIntent.executionId,
   exitExecutionId:exitIntent.executionId,
   canaryMaxOrder:canaryPolicy.maxOrderNotionalMinor.toString(),
   canaryDaily:canaryPolicy.maxDailySubmittedNotionalMinor.toString(),
   signerPerTx:signerPolicy.perTransactionCapMinor.toString(),
   signerDaily:signerPolicy.rolling24hCapMinor.toString(),
  }),
  walletConnectionId:entryIntent.walletConnectionId,
  provider:'jupiter-ultra',
  entryExecutionId:entryIntent.executionId,
  exitExecutionId:exitIntent.executionId,
  maxOrderNotionalMinor:canaryPolicy.maxOrderNotionalMinor,
  maxDailySubmittedNotionalMinor:canaryPolicy.maxDailySubmittedNotionalMinor,
  signerPerTransactionCapMinor:signerPolicy.perTransactionCapMinor,
  signerRolling24hCapMinor:signerPolicy.rolling24hCapMinor,
  passed:true as const,
  evidenceIds:unique(input.evidenceIds),
  authority:'CAPITAL_BOUNDARY_EVIDENCE_ONLY' as const,
 })
}

export async function proveDexKillSwitch(input:{
 canaryStore:LiveCanaryStateStore
 permitStore:PermitStore
 policy:LiveCanaryPolicy
 provider:'jupiter-ultra'
 walletConnectionId:string
 tradingDate:string
 currency:string
 now:string
 evidenceIds:readonly string[]
}):Promise<DexKillSwitchProof>{
 if(!input.evidenceIds.length)throw new Error('DEX_COMMISSION_KILL_SWITCH_EVIDENCE_REQUIRED')
 const activation=await activateLiveKillSwitch({
  store:input.canaryStore,
  permitStore:input.permitStore,
  provider:input.provider,
  accountId:input.walletConnectionId,
  tradingDate:input.tradingDate,
  reason:'DEX_COMMISSION_CONTROLLED_CANARY_DRILL',
  now:input.now,
 })
 const result=await input.canaryStore.reserve({
  provider:input.provider,
  accountId:input.walletConnectionId,
  tradingDate:input.tradingDate,
  currency:input.currency,
  notionalMinor:1n,
  side:'BUY',
  policy:input.policy,
  now:input.now,
 })
 if(result.allowed||!result.reasonCodes.includes('KILL_SWITCH_ACTIVE'))throw new Error('DEX_COMMISSION_KILL_SWITCH_NOT_PROVEN')
 return Object.freeze({
  proofId:'dex:kill-switch:'+hashDexRuntime({walletConnectionId:input.walletConnectionId,tradingDate:input.tradingDate,activatedAt:activation.activatedAt}),
  provider:input.provider,
  walletConnectionId:input.walletConnectionId,
  tradingDate:input.tradingDate,
  activatedAt:activation.activatedAt,
  reserveBlockedAfterHalt:true as const,
  reasonCodes:Object.freeze([...result.reasonCodes]),
  evidenceIds:unique([...input.evidenceIds,'kill-switch:'+activation.activatedAt]),
  authority:'EMERGENCY_STOP_EVIDENCE_ONLY' as const,
 })
}

function assertLegPair(input:{
 entrySubmit:DexCanarySubmitResult
 entryReconcile:DexCanaryReconcileResult
 exitSubmit:DexCanarySubmitResult
 exitReconcile:DexCanaryReconcileResult
}):void{
 const {entrySubmit,entryReconcile,exitSubmit,exitReconcile}=input
 if(entrySubmit.attempt.leg!=='ENTRY'||exitSubmit.attempt.leg!=='EXIT')throw new Error('DEX_COMMISSION_FINAL_LEG_ORDER_INVALID')
 if(entrySubmit.attempt.executionId===exitSubmit.attempt.executionId)throw new Error('DEX_COMMISSION_FINAL_EXECUTION_IDS_MUST_DIFFER')
 if(entrySubmit.attempt.runLineageId!==exitSubmit.attempt.runLineageId)throw new Error('DEX_COMMISSION_FINAL_LINEAGE_MISMATCH')
 if(entrySubmit.attempt.walletConnectionId!==exitSubmit.attempt.walletConnectionId)throw new Error('DEX_COMMISSION_FINAL_WALLET_MISMATCH')
 if(entryReconcile.attempt.state!=='RECONCILED'||exitReconcile.attempt.state!=='RECONCILED')throw new Error('DEX_COMMISSION_FINAL_RECONCILIATION_REQUIRED')
 if(!entryReconcile.reconciliation?.passed||!exitReconcile.reconciliation?.passed)throw new Error('DEX_COMMISSION_FINAL_RECONCILIATION_FAILED')
 if(!entrySubmit.providerReceipt.signature||!exitSubmit.providerReceipt.signature)throw new Error('DEX_COMMISSION_FINAL_PROVIDER_SIGNATURES_REQUIRED')
 if(entrySubmit.providerReceipt.signature!==entryReconcile.onchain.signature||exitSubmit.providerReceipt.signature!==exitReconcile.onchain.signature)throw new Error('DEX_COMMISSION_FINAL_PROVIDER_CHAIN_SIGNATURE_MISMATCH')
 if(!entryReconcile.onchain.confirmed||entryReconcile.onchain.failed||!exitReconcile.onchain.confirmed||exitReconcile.onchain.failed)throw new Error('DEX_COMMISSION_FINAL_CHAIN_CONFIRMATION_REQUIRED')
 if(exitReconcile.onchain.inputPostBalanceAtomic!==0n)throw new Error('DEX_COMMISSION_FINAL_POSITION_NOT_FLAT')
}

export function buildDexControlledLiveCanaryEvidence(input:{
 stageId:string
 strategyId:string
 instrumentId:string
 integrityGuard:Edge007IntegrityReceipt
 startedAt:string
 endedAt:string
 informationCutoff:string
 entrySubmit:DexCanarySubmitResult
 entryReconcile:DexCanaryReconcileResult
 exitSubmit:DexCanarySubmitResult
 exitReconcile:DexCanaryReconcileResult
 capitalProof:DexCapitalBoundaryProof
 recoveryProof:DexRestartRecoveryProof
 killSwitchProof:DexKillSwitchProof
 evidenceIds:readonly string[]
}):DexExecutionStageEvidence{
 assertLegPair(input)
 const {entrySubmit,entryReconcile,exitSubmit,exitReconcile,capitalProof,recoveryProof,killSwitchProof}=input
 const walletConnectionId=entrySubmit.attempt.walletConnectionId
 if(capitalProof.walletConnectionId!==walletConnectionId||killSwitchProof.walletConnectionId!==walletConnectionId)throw new Error('DEX_COMMISSION_FINAL_PROOF_WALLET_MISMATCH')
 if(![entrySubmit.attempt.attemptId,exitSubmit.attempt.attemptId].includes(recoveryProof.attemptId))throw new Error('DEX_COMMISSION_FINAL_RECOVERY_PROOF_MISMATCH')
 if(recoveryProof.recoveredState!=='RECONCILED'||killSwitchProof.reserveBlockedAfterHalt!==true||capitalProof.passed!==true)throw new Error('DEX_COMMISSION_FINAL_PROOF_INVALID')
 if(entrySubmit.simulation.feeLamports===undefined||exitSubmit.simulation.feeLamports===undefined)throw new Error('DEX_COMMISSION_FINAL_SIMULATED_FEES_REQUIRED')
 if(entrySubmit.simulation.feeLamports!==entryReconcile.onchain.feeLamports||exitSubmit.simulation.feeLamports!==exitReconcile.onchain.feeLamports)throw new Error('DEX_COMMISSION_FINAL_EXECUTION_COST_MISMATCH')
 const providerReceiptIds=[entrySubmit.providerReceipt.receiptId,exitSubmit.providerReceipt.receiptId]
 const signatures=[entrySubmit.providerReceipt.signature!,exitSubmit.providerReceipt.signature!]
 const evidence=unique([
  ...input.evidenceIds,
  ...entrySubmit.attempt.evidenceIds,
  ...exitSubmit.attempt.evidenceIds,
  ...entryReconcile.reconciliation!.evidenceIds,
  ...exitReconcile.reconciliation!.evidenceIds,
  ...capitalProof.evidenceIds,
  ...recoveryProof.evidenceIds,
  ...killSwitchProof.evidenceIds,
 ])
 if(!evidence.length)throw new Error('DEX_COMMISSION_FINAL_EVIDENCE_REQUIRED')
 return Object.freeze({
  stageId:input.stageId,
  stage:'CONTROLLED_LIVE_CANARY' as const,
  origin:'LIVE_RUNTIME_ATTESTED' as const,
  runLineageId:entrySubmit.attempt.runLineageId,
  strategyId:input.strategyId,
  instrumentId:input.instrumentId,
  walletConnectionId,
  entryExecutionId:entrySubmit.attempt.executionId,
  exitExecutionId:exitSubmit.attempt.executionId,
  startedAt:input.startedAt,
  endedAt:input.endedAt,
  informationCutoff:input.informationCutoff,
  integrityGuard:input.integrityGuard,
  decisionCount:2,
  signedTransactionCount:2,
  simulationCount:2,
  simulationFailureCount:0,
  broadcastCount:2,
  entryBroadcastCount:1,
  exitBroadcastCount:1,
  reconciledBroadcastCount:2,
  duplicateBroadcastCount:0,
  unknownExecutionCount:0,
  futureEvidenceCount:0,
  signerBoundary:'ISOLATED' as const,
  privateKeyMaterialObserved:false,
  capitalBounded:true,
  killSwitchProven:true,
  restartRecoveryProven:true,
  sellabilityProven:true,
  positionFlatAfterExit:true,
  executionCostReconciled:true,
  providerReceiptIds:Object.freeze(providerReceiptIds),
  onchainSignatureIds:Object.freeze(signatures),
  evidenceIds:evidence,
 })
}

export function createDexLiveRuntimeVerificationReceipt(input:{
 evidence:DexExecutionStageEvidence
 entrySubmit:DexCanarySubmitResult
 entryReconcile:DexCanaryReconcileResult
 exitSubmit:DexCanarySubmitResult
 exitReconcile:DexCanaryReconcileResult
 verifiedAt:string
}):DexLiveCanaryVerificationReceipt{
 if(input.evidence.stage!=='CONTROLLED_LIVE_CANARY')throw new Error('DEX_COMMISSION_RUNTIME_STAGE_INVALID')
 assertLegPair(input)
 if(Number.isNaN(Date.parse(input.verifiedAt))||input.verifiedAt<input.evidence.endedAt)throw new Error('DEX_COMMISSION_RUNTIME_VERIFIED_AT_INVALID')
 const providerReceiptIds=[input.entrySubmit.providerReceipt.receiptId,input.exitSubmit.providerReceipt.receiptId]
 const signatures=[input.entryReconcile.onchain.signature,input.exitReconcile.onchain.signature]
 if(JSON.stringify(providerReceiptIds)!==JSON.stringify([...input.evidence.providerReceiptIds]))throw new Error('DEX_COMMISSION_RUNTIME_PROVIDER_RECEIPTS_MISMATCH')
 if(JSON.stringify(signatures)!==JSON.stringify([...input.evidence.onchainSignatureIds]))throw new Error('DEX_COMMISSION_RUNTIME_SIGNATURES_MISMATCH')
 return Object.freeze({
  verificationId:'dex:runtime-verification:'+hashDexRuntime({stageId:input.evidence.stageId,providerReceiptIds,signatures,verifiedAt:input.verifiedAt}),
  stageId:input.evidence.stageId,
  runLineageId:input.evidence.runLineageId,
  walletConnectionId:input.evidence.walletConnectionId!,
  entryExecutionId:input.evidence.entryExecutionId!,
  exitExecutionId:input.evidence.exitExecutionId!,
  stageEvidenceHash:dexLiveCanaryEvidenceHash(input.evidence),
  verifiedAt:input.verifiedAt,
  providerReceiptIds:Object.freeze(providerReceiptIds),
  onchainSignatureIds:Object.freeze(signatures),
  providerEvidenceVerified:true as const,
  onchainEvidenceVerified:true as const,
  source:'COMMISSIONED_DEX_RUNTIME' as const,
  authority:'RUNTIME_EVIDENCE_ONLY' as const,
 })
}

export function certifyDexCommissionFinal(input:{
 connector:MoneyMarketConnectorDescriptor
 wallet:ConnectedWallet
 signerLease:SignerLease
 stages:readonly DexExecutionStageEvidence[]
 liveCanaryVerification?:DexLiveCanaryVerificationReceipt
}):DexCommissionFinalReport{
 const blockers:string[]=[]
 if(input.connector.lane!=='DEX'||input.connector.provider!=='jupiter-ultra')blockers.push('DEX_COMMISSION_PROVIDER_NOT_COMMISSIONED')
 if(input.connector.admission!=='CONTROLLED_CANARY')blockers.push('DEX_COMMISSION_CONTROLLED_CANARY_ADMISSION_REQUIRED')
 if(!input.connector.credentialRef?.trim())blockers.push('DEX_COMMISSION_PROVIDER_CREDENTIAL_REFERENCE_REQUIRED')
 if(input.wallet.mode!=='COFFER_EXECUTION_WALLET'||input.wallet.network!=='SOLANA'||input.wallet.connectionId!==input.signerLease.walletConnectionId)blockers.push('DEX_COMMISSION_ISOLATED_COFFER_WALLET_REQUIRED')
 if(input.signerLease.state!=='ACTIVE'||input.signerLease.containsPrivateKey!==false||input.signerLease.containsRawToken!==false)blockers.push('DEX_COMMISSION_ACTIVE_SECRET_FREE_SIGNER_LEASE_REQUIRED')
 const stageReport=certifyDexExecutionLadder({stages:input.stages,liveCanaryVerification:input.liveCanaryVerification})
 try{assertDexControlledLiveCanaryCertified(stageReport)}catch{blockers.push('DEX_COMMISSION_RUNTIME_CANARY_REQUIRED')}
 const passed=blockers.length===0
 return Object.freeze({
  reportId:'dex-commission-final:'+hashDexRuntime({connectorId:input.connector.connectorId,walletConnectionId:input.wallet.connectionId,signerLeaseId:input.signerLease.leaseId,stageReportId:stageReport.reportId,blockers}),
  status:passed?'CONTROLLED_CANARY_CERTIFIED' as const:'SOFTWARE_READY_RUNTIME_CANARY_REQUIRED' as const,
  passed,
  stageReport,
  blockerCodes:Object.freeze([...new Set(blockers)]),
  softwareReady:true as const,
  controlledLiveCanaryCertified:passed&&stageReport.controlledLiveCanaryCertified,
  unrestrictedLiveAuthorized:false as const,
  authority:'CERTIFICATION_ONLY' as const,
 })
}
