import { createHash } from 'node:crypto'

export const DEX_EXECUTION_LADDER_VERSION = 'DEX-EXECUTION-4STAGE-v2' as const
export const EDGE_007_REQUIRED_VERSION = 'EDGE-007-v1' as const

export type DexExecutionStage =
  | 'HISTORICAL_REPLAY'
  | 'LIVE_SHADOW'
  | 'SIGNED_SIMULATION_NO_BROADCAST'
  | 'CONTROLLED_LIVE_CANARY'

export type DexEvidenceOrigin =
  | 'SYNTHETIC_TEST'
  | 'RECORDED_REAL_MARKET'
  | 'LIVE_RUNTIME_ATTESTED'

export type Edge007IntegrityReceipt = Readonly<{
  guardVersion: typeof EDGE_007_REQUIRED_VERSION
  guardId: string
  disposition: 'PASS' | 'BLOCK'
  reasonCodes: readonly string[]
  evidenceIds: readonly string[]
  authority: 'INTEGRITY_VETO_ONLY'
  canAuthorizeTrade: false
  canAuthorizePromotion: false
}>

export type DexExecutionStageEvidence = Readonly<{
  stageId: string
  stage: DexExecutionStage
  origin: DexEvidenceOrigin
  runLineageId: string
  strategyId: string
  instrumentId: string
  walletConnectionId?: string
  entryExecutionId?: string
  exitExecutionId?: string
  startedAt: string
  endedAt: string
  informationCutoff: string
  integrityGuard: Edge007IntegrityReceipt
  decisionCount: number
  signedTransactionCount: number
  simulationCount: number
  simulationFailureCount: number
  broadcastCount: number
  entryBroadcastCount: number
  exitBroadcastCount: number
  reconciledBroadcastCount: number
  duplicateBroadcastCount: number
  unknownExecutionCount: number
  futureEvidenceCount: number
  signerBoundary: 'NOT_APPLICABLE' | 'ISOLATED'
  privateKeyMaterialObserved: boolean
  capitalBounded: boolean
  killSwitchProven: boolean
  restartRecoveryProven: boolean
  sellabilityProven: boolean
  positionFlatAfterExit: boolean
  executionCostReconciled: boolean
  providerReceiptIds: readonly string[]
  onchainSignatureIds: readonly string[]
  evidenceIds: readonly string[]
}>

export type DexLiveCanaryVerificationReceipt = Readonly<{
  verificationId: string
  stageId: string
  runLineageId: string
  walletConnectionId: string
  entryExecutionId: string
  exitExecutionId: string
  stageEvidenceHash: string
  verifiedAt: string
  providerReceiptIds: readonly string[]
  onchainSignatureIds: readonly string[]
  providerEvidenceVerified: true
  onchainEvidenceVerified: true
  source: 'COMMISSIONED_DEX_RUNTIME'
  authority: 'RUNTIME_EVIDENCE_ONLY'
}>

export type DexStageCertification = Readonly<{
  stage: DexExecutionStage
  stageId: string
  passed: boolean
  operationalEvidence: boolean
  reasonCodes: readonly string[]
  authority: 'CERTIFICATION_ONLY'
  canAuthorizeTrade: false
}>

export type DexExecutionLadderReport = Readonly<{
  reportId: string
  version: typeof DEX_EXECUTION_LADDER_VERSION
  stages: readonly DexStageCertification[]
  softwareCertified: boolean
  operationallyCertified: boolean
  controlledLiveCanaryCertified: boolean
  unrestrictedLiveAuthorized: false
  missingStages: readonly DexExecutionStage[]
  reasonCodes: readonly string[]
  authority: 'CERTIFICATION_ONLY'
}>

const ORDER: readonly DexExecutionStage[] = Object.freeze([
  'HISTORICAL_REPLAY',
  'LIVE_SHADOW',
  'SIGNED_SIMULATION_NO_BROADCAST',
  'CONTROLLED_LIVE_CANARY',
])

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function validIso(value: string): boolean {
  return Boolean(value.trim()) && !Number.isNaN(Date.parse(value))
}

function nonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

function pushIf(reasons: string[], condition: boolean, code: string): void {
  if (condition) reasons.push(code)
}

function assertCommon(evidence: DexExecutionStageEvidence, reasons: string[]): void {
  pushIf(reasons, !evidence.stageId.trim(), 'DEX_STAGE_ID_REQUIRED')
  pushIf(reasons, !evidence.runLineageId.trim(), 'DEX_STAGE_LINEAGE_ID_REQUIRED')
  pushIf(reasons, !evidence.strategyId.trim(), 'DEX_STAGE_STRATEGY_ID_REQUIRED')
  pushIf(reasons, !evidence.instrumentId.trim(), 'DEX_STAGE_INSTRUMENT_ID_REQUIRED')
  pushIf(reasons, !validIso(evidence.startedAt), 'DEX_STAGE_STARTED_AT_INVALID')
  pushIf(reasons, !validIso(evidence.endedAt), 'DEX_STAGE_ENDED_AT_INVALID')
  pushIf(reasons, !validIso(evidence.informationCutoff), 'DEX_STAGE_INFORMATION_CUTOFF_INVALID')
  if (validIso(evidence.startedAt) && validIso(evidence.endedAt)) {
    pushIf(reasons, evidence.endedAt < evidence.startedAt, 'DEX_STAGE_TIME_WINDOW_INVALID')
  }
  if (validIso(evidence.endedAt) && validIso(evidence.informationCutoff)) {
    pushIf(reasons, evidence.informationCutoff > evidence.endedAt, 'DEX_STAGE_CUTOFF_AFTER_END')
  }

  for (const [value, code] of [
    [evidence.decisionCount, 'DEX_STAGE_DECISION_COUNT_INVALID'],
    [evidence.signedTransactionCount, 'DEX_STAGE_SIGNED_COUNT_INVALID'],
    [evidence.simulationCount, 'DEX_STAGE_SIMULATION_COUNT_INVALID'],
    [evidence.simulationFailureCount, 'DEX_STAGE_SIMULATION_FAILURE_COUNT_INVALID'],
    [evidence.broadcastCount, 'DEX_STAGE_BROADCAST_COUNT_INVALID'],
    [evidence.entryBroadcastCount, 'DEX_STAGE_ENTRY_BROADCAST_COUNT_INVALID'],
    [evidence.exitBroadcastCount, 'DEX_STAGE_EXIT_BROADCAST_COUNT_INVALID'],
    [evidence.reconciledBroadcastCount, 'DEX_STAGE_RECONCILED_COUNT_INVALID'],
    [evidence.duplicateBroadcastCount, 'DEX_STAGE_DUPLICATE_COUNT_INVALID'],
    [evidence.unknownExecutionCount, 'DEX_STAGE_UNKNOWN_COUNT_INVALID'],
    [evidence.futureEvidenceCount, 'DEX_STAGE_FUTURE_EVIDENCE_COUNT_INVALID'],
  ] as const) {
    pushIf(reasons, !nonNegativeInteger(value), code)
  }

  pushIf(reasons, !evidence.evidenceIds.length, 'DEX_STAGE_EVIDENCE_REQUIRED')
  pushIf(reasons, evidence.integrityGuard.guardVersion !== EDGE_007_REQUIRED_VERSION, 'DEX_EDGE007_VERSION_REQUIRED')
  pushIf(reasons, evidence.integrityGuard.authority !== 'INTEGRITY_VETO_ONLY', 'DEX_EDGE007_AUTHORITY_INVALID')
  pushIf(reasons, evidence.integrityGuard.canAuthorizeTrade !== false, 'DEX_EDGE007_TRADE_AUTHORITY_FORBIDDEN')
  pushIf(reasons, evidence.integrityGuard.canAuthorizePromotion !== false, 'DEX_EDGE007_PROMOTION_AUTHORITY_FORBIDDEN')
  pushIf(reasons, evidence.integrityGuard.disposition !== 'PASS', 'DEX_EDGE007_BLOCKED')
  pushIf(reasons, evidence.integrityGuard.reasonCodes.length !== 0, 'DEX_EDGE007_REASONS_PRESENT')
  pushIf(reasons, !evidence.integrityGuard.evidenceIds.length, 'DEX_EDGE007_EVIDENCE_REQUIRED')
  pushIf(reasons, evidence.privateKeyMaterialObserved, 'DEX_PRIVATE_KEY_MATERIAL_FORBIDDEN')
}

function operationalOriginFor(stage: DexExecutionStage, origin: DexEvidenceOrigin): boolean {
  if (stage === 'HISTORICAL_REPLAY') return origin === 'RECORDED_REAL_MARKET' || origin === 'LIVE_RUNTIME_ATTESTED'
  if (stage === 'LIVE_SHADOW') return origin === 'RECORDED_REAL_MARKET' || origin === 'LIVE_RUNTIME_ATTESTED'
  if (stage === 'SIGNED_SIMULATION_NO_BROADCAST') return origin === 'LIVE_RUNTIME_ATTESTED'
  // A pure/static stage validator can never establish a real broadcast happened.
  // Stage 4 becomes operational only through a separately bound commissioned-runtime receipt.
  return false
}

export function certifyDexExecutionStage(evidence: DexExecutionStageEvidence): DexStageCertification {
  const reasons: string[] = []
  assertCommon(evidence, reasons)

  if (evidence.stage === 'HISTORICAL_REPLAY') {
    pushIf(reasons, evidence.futureEvidenceCount !== 0, 'DEX_REPLAY_FUTURE_LEAKAGE')
    pushIf(reasons, evidence.broadcastCount !== 0, 'DEX_REPLAY_BROADCAST_FORBIDDEN')
    pushIf(reasons, evidence.signedTransactionCount !== 0, 'DEX_REPLAY_SIGNING_FORBIDDEN')
    pushIf(reasons, evidence.reconciledBroadcastCount !== 0, 'DEX_REPLAY_RECONCILIATION_UNEXPECTED')
    pushIf(reasons, evidence.decisionCount < 1, 'DEX_REPLAY_DECISIONS_REQUIRED')
  }

  if (evidence.stage === 'LIVE_SHADOW') {
    pushIf(reasons, evidence.decisionCount < 1, 'DEX_SHADOW_DECISIONS_REQUIRED')
    pushIf(reasons, evidence.futureEvidenceCount !== 0, 'DEX_SHADOW_FUTURE_LEAKAGE')
    pushIf(reasons, evidence.broadcastCount !== 0, 'DEX_SHADOW_BROADCAST_FORBIDDEN')
    pushIf(reasons, evidence.signedTransactionCount !== 0, 'DEX_SHADOW_SIGNING_FORBIDDEN')
    pushIf(reasons, evidence.reconciledBroadcastCount !== 0, 'DEX_SHADOW_RECONCILIATION_UNEXPECTED')
  }

  if (evidence.stage === 'SIGNED_SIMULATION_NO_BROADCAST') {
    pushIf(reasons, !evidence.walletConnectionId?.trim(), 'DEX_SIMULATION_WALLET_BINDING_REQUIRED')
    pushIf(reasons, evidence.decisionCount < 1, 'DEX_SIMULATION_DECISIONS_REQUIRED')
    pushIf(reasons, evidence.signerBoundary !== 'ISOLATED', 'DEX_SIMULATION_ISOLATED_SIGNER_REQUIRED')
    pushIf(reasons, evidence.signedTransactionCount < 1, 'DEX_SIMULATION_SIGNED_TRANSACTION_REQUIRED')
    pushIf(reasons, evidence.simulationCount < 1, 'DEX_SIMULATION_REQUIRED')
    pushIf(reasons, evidence.simulationFailureCount !== 0, 'DEX_SIMULATION_FAILURE_PRESENT')
    pushIf(reasons, evidence.broadcastCount !== 0, 'DEX_SIMULATION_BROADCAST_FORBIDDEN')
    pushIf(reasons, evidence.reconciledBroadcastCount !== 0, 'DEX_SIMULATION_RECONCILIATION_UNEXPECTED')
    pushIf(reasons, evidence.providerReceiptIds.length !== 0, 'DEX_SIMULATION_PROVIDER_RECEIPT_UNEXPECTED')
    pushIf(reasons, evidence.onchainSignatureIds.length !== 0, 'DEX_SIMULATION_ONCHAIN_SIGNATURE_UNEXPECTED')
  }

  if (evidence.stage === 'CONTROLLED_LIVE_CANARY') {
    pushIf(reasons, evidence.origin !== 'LIVE_RUNTIME_ATTESTED', 'DEX_CANARY_LIVE_RUNTIME_ATTESTATION_REQUIRED')
    pushIf(reasons, !evidence.walletConnectionId?.trim(), 'DEX_CANARY_WALLET_BINDING_REQUIRED')
    pushIf(reasons, !evidence.entryExecutionId?.trim(), 'DEX_CANARY_ENTRY_EXECUTION_ID_REQUIRED')
    pushIf(reasons, !evidence.exitExecutionId?.trim(), 'DEX_CANARY_EXIT_EXECUTION_ID_REQUIRED')
    pushIf(reasons, Boolean(evidence.entryExecutionId && evidence.exitExecutionId && evidence.entryExecutionId === evidence.exitExecutionId), 'DEX_CANARY_ENTRY_EXIT_EXECUTIONS_MUST_DIFFER')
    pushIf(reasons, evidence.decisionCount < 1, 'DEX_CANARY_DECISIONS_REQUIRED')
    pushIf(reasons, evidence.signerBoundary !== 'ISOLATED', 'DEX_CANARY_ISOLATED_SIGNER_REQUIRED')
    pushIf(reasons, evidence.signedTransactionCount < 1, 'DEX_CANARY_SIGNED_TRANSACTION_REQUIRED')
    pushIf(reasons, evidence.simulationCount < 1, 'DEX_CANARY_PREFLIGHT_SIMULATION_REQUIRED')
    pushIf(reasons, evidence.simulationFailureCount !== 0, 'DEX_CANARY_SIMULATION_FAILURE_PRESENT')
    pushIf(reasons, evidence.signedTransactionCount < 2, 'DEX_CANARY_ROUND_TRIP_SIGNED_TRANSACTIONS_REQUIRED')
    pushIf(reasons, evidence.simulationCount < 2, 'DEX_CANARY_ROUND_TRIP_PREFLIGHT_REQUIRED')
    pushIf(reasons, evidence.broadcastCount !== 2, 'DEX_CANARY_ROUND_TRIP_BROADCASTS_REQUIRED')
    pushIf(reasons, evidence.entryBroadcastCount !== 1, 'DEX_CANARY_ENTRY_BROADCAST_REQUIRED')
    pushIf(reasons, evidence.exitBroadcastCount !== 1, 'DEX_CANARY_EXIT_BROADCAST_REQUIRED')
    pushIf(reasons, evidence.reconciledBroadcastCount !== 2, 'DEX_CANARY_ROUND_TRIP_RECONCILIATION_REQUIRED')
    pushIf(reasons, evidence.duplicateBroadcastCount !== 0, 'DEX_CANARY_DUPLICATE_BROADCAST')
    pushIf(reasons, evidence.unknownExecutionCount !== 0, 'DEX_CANARY_UNKNOWN_EXECUTION')
    pushIf(reasons, !evidence.capitalBounded, 'DEX_CANARY_CAPITAL_BOUNDARY_REQUIRED')
    pushIf(reasons, !evidence.killSwitchProven, 'DEX_CANARY_KILL_SWITCH_REQUIRED')
    pushIf(reasons, !evidence.restartRecoveryProven, 'DEX_CANARY_RESTART_RECOVERY_REQUIRED')
    pushIf(reasons, !evidence.sellabilityProven, 'DEX_CANARY_SELLABILITY_REQUIRED')
    pushIf(reasons, !evidence.positionFlatAfterExit, 'DEX_CANARY_POSITION_MUST_BE_FLAT_AFTER_EXIT')
    pushIf(reasons, !evidence.executionCostReconciled, 'DEX_CANARY_EXECUTION_COST_RECONCILIATION_REQUIRED')
    pushIf(reasons, evidence.providerReceiptIds.length < 2, 'DEX_CANARY_PROVIDER_RECEIPTS_REQUIRED')
    pushIf(reasons, evidence.onchainSignatureIds.length !== 2, 'DEX_CANARY_ONCHAIN_SIGNATURES_REQUIRED')
  }

  const uniqueReasons = Object.freeze([...new Set(reasons)])
  return Object.freeze({
    stage: evidence.stage,
    stageId: evidence.stageId,
    passed: uniqueReasons.length === 0,
    operationalEvidence: uniqueReasons.length === 0 && operationalOriginFor(evidence.stage, evidence.origin),
    reasonCodes: uniqueReasons,
    authority: 'CERTIFICATION_ONLY',
    canAuthorizeTrade: false,
  })
}

export function dexLiveCanaryEvidenceHash(evidence: DexExecutionStageEvidence): string {
  if (evidence.stage !== 'CONTROLLED_LIVE_CANARY') throw new Error('DEX_CANARY_EVIDENCE_STAGE_INVALID')
  return hash(evidence)
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort())
}

function liveCanaryVerificationMatches(
  evidence: DexExecutionStageEvidence,
  receipt: DexLiveCanaryVerificationReceipt,
): boolean {
  if (evidence.stage !== 'CONTROLLED_LIVE_CANARY') return false
  if (receipt.source !== 'COMMISSIONED_DEX_RUNTIME' || receipt.authority !== 'RUNTIME_EVIDENCE_ONLY') return false
  if (!receipt.verificationId.trim() || !validIso(receipt.verifiedAt)) return false
  if (Date.parse(receipt.verifiedAt) < Date.parse(evidence.endedAt)) return false
  if (
    receipt.stageId !== evidence.stageId ||
    receipt.runLineageId !== evidence.runLineageId ||
    receipt.walletConnectionId !== evidence.walletConnectionId ||
    receipt.entryExecutionId !== evidence.entryExecutionId ||
    receipt.exitExecutionId !== evidence.exitExecutionId
  ) return false
  if (receipt.stageEvidenceHash !== dexLiveCanaryEvidenceHash(evidence)) return false
  if (!sameStrings(receipt.providerReceiptIds, evidence.providerReceiptIds)) return false
  if (!sameStrings(receipt.onchainSignatureIds, evidence.onchainSignatureIds)) return false
  return receipt.providerEvidenceVerified === true && receipt.onchainEvidenceVerified === true
}

export function certifyDexExecutionLadder(input: {
  stages: readonly DexExecutionStageEvidence[]
  liveCanaryVerification?: DexLiveCanaryVerificationReceipt
}): DexExecutionLadderReport {
  const byStage = new Map<DexExecutionStage, DexExecutionStageEvidence>()
  const reasons: string[] = []

  for (const evidence of input.stages) {
    if (byStage.has(evidence.stage)) reasons.push(`DEX_STAGE_DUPLICATE:${evidence.stage}`)
    else byStage.set(evidence.stage, evidence)
  }

  const missingStages = ORDER.filter((stage) => !byStage.has(stage))
  const lineageKeys = new Set([...byStage.values()].map((evidence) => `${evidence.runLineageId}|${evidence.strategyId}|${evidence.instrumentId}`))
  if (lineageKeys.size > 1) reasons.push('DEX_STAGE_LINEAGE_MISMATCH')
  const certifications = ORDER.flatMap((stage) => {
    const evidence = byStage.get(stage)
    return evidence ? [certifyDexExecutionStage(evidence)] : []
  })

  for (let index = 1; index < ORDER.length; index += 1) {
    const prior = byStage.get(ORDER[index - 1]!)
    const current = byStage.get(ORDER[index]!)
    if (prior && current && current.startedAt < prior.endedAt) {
      reasons.push(`DEX_STAGE_ORDER_INVALID:${ORDER[index - 1]}->${ORDER[index]}`)
    }
  }

  const firstThree = ORDER.slice(0, 3)
  const softwareCertified = firstThree.every((stage) =>
    certifications.find((certification) => certification.stage === stage)?.passed === true,
  )
  const operationalFirstThree = firstThree.every((stage) =>
    certifications.find((certification) => certification.stage === stage)?.operationalEvidence === true,
  )
  const canary = certifications.find((certification) => certification.stage === 'CONTROLLED_LIVE_CANARY')
  const canaryEvidence = byStage.get('CONTROLLED_LIVE_CANARY')
  const liveVerificationValid = Boolean(
    canaryEvidence &&
    canary?.passed === true &&
    input.liveCanaryVerification &&
    liveCanaryVerificationMatches(canaryEvidence, input.liveCanaryVerification),
  )
  if (canaryEvidence && canary?.passed === true && !input.liveCanaryVerification) {
    reasons.push('DEX_CANARY_RUNTIME_VERIFICATION_REQUIRED')
  } else if (canaryEvidence && canary?.passed === true && input.liveCanaryVerification && !liveVerificationValid) {
    reasons.push('DEX_CANARY_RUNTIME_VERIFICATION_INVALID')
  }
  const controlledLiveCanaryCertified = canary?.passed === true && liveVerificationValid
  const operationallyCertified =
    missingStages.length === 0 &&
    reasons.length === 0 &&
    softwareCertified &&
    operationalFirstThree &&
    controlledLiveCanaryCertified

  for (const certification of certifications) {
    for (const reason of certification.reasonCodes) reasons.push(`${certification.stage}:${reason}`)
  }
  for (const stage of missingStages) reasons.push(`DEX_STAGE_MISSING:${stage}`)

  const uniqueReasons = Object.freeze([...new Set(reasons)])
  const stable = certifications.map((stage) => ({
    stage: stage.stage,
    stageId: stage.stageId,
    passed: stage.passed,
    operationalEvidence: stage.operationalEvidence,
    reasonCodes: stage.reasonCodes,
  }))

  return Object.freeze({
    reportId: `dex-4stage:${hash({ stages: stable, missingStages, reasons: uniqueReasons, liveVerificationId: input.liveCanaryVerification?.verificationId ?? null })}`,
    version: DEX_EXECUTION_LADDER_VERSION,
    stages: Object.freeze(certifications),
    softwareCertified,
    operationallyCertified,
    controlledLiveCanaryCertified,
    unrestrictedLiveAuthorized: false,
    missingStages: Object.freeze(missingStages),
    reasonCodes: uniqueReasons,
    authority: 'CERTIFICATION_ONLY',
  })
}

export function assertDexControlledLiveCanaryCertified(report: DexExecutionLadderReport): void {
  if (
    report.version !== DEX_EXECUTION_LADDER_VERSION ||
    report.authority !== 'CERTIFICATION_ONLY' ||
    report.unrestrictedLiveAuthorized !== false
  ) {
    throw new Error('DEX_CERTIFICATION_AUTHORITY_INVALID')
  }
  if (!report.operationallyCertified || !report.controlledLiveCanaryCertified || report.reasonCodes.length) {
    throw new Error('DEX_CONTROLLED_LIVE_CANARY_NOT_CERTIFIED')
  }
}
