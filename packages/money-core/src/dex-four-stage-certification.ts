import { createHash } from 'node:crypto'

export const DEX_EXECUTION_LADDER_VERSION = 'DEX-EXECUTION-4STAGE-v1' as const
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
  startedAt: string
  endedAt: string
  informationCutoff: string
  integrityGuard: Edge007IntegrityReceipt
  decisionCount: number
  signedTransactionCount: number
  simulationCount: number
  simulationFailureCount: number
  broadcastCount: number
  reconciledBroadcastCount: number
  duplicateBroadcastCount: number
  unknownExecutionCount: number
  futureEvidenceCount: number
  signerBoundary: 'NOT_APPLICABLE' | 'ISOLATED'
  privateKeyMaterialObserved: boolean
  capitalBounded: boolean
  killSwitchProven: boolean
  providerReceiptIds: readonly string[]
  onchainSignatureIds: readonly string[]
  evidenceIds: readonly string[]
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
  return origin === 'LIVE_RUNTIME_ATTESTED'
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
    pushIf(reasons, evidence.decisionCount < 1, 'DEX_CANARY_DECISIONS_REQUIRED')
    pushIf(reasons, evidence.signerBoundary !== 'ISOLATED', 'DEX_CANARY_ISOLATED_SIGNER_REQUIRED')
    pushIf(reasons, evidence.signedTransactionCount < 1, 'DEX_CANARY_SIGNED_TRANSACTION_REQUIRED')
    pushIf(reasons, evidence.simulationCount < 1, 'DEX_CANARY_PREFLIGHT_SIMULATION_REQUIRED')
    pushIf(reasons, evidence.simulationFailureCount !== 0, 'DEX_CANARY_SIMULATION_FAILURE_PRESENT')
    pushIf(reasons, evidence.broadcastCount !== 1, 'DEX_CANARY_EXACTLY_ONE_BROADCAST_REQUIRED')
    pushIf(reasons, evidence.reconciledBroadcastCount !== 1, 'DEX_CANARY_RECONCILIATION_REQUIRED')
    pushIf(reasons, evidence.duplicateBroadcastCount !== 0, 'DEX_CANARY_DUPLICATE_BROADCAST')
    pushIf(reasons, evidence.unknownExecutionCount !== 0, 'DEX_CANARY_UNKNOWN_EXECUTION')
    pushIf(reasons, !evidence.capitalBounded, 'DEX_CANARY_CAPITAL_BOUNDARY_REQUIRED')
    pushIf(reasons, !evidence.killSwitchProven, 'DEX_CANARY_KILL_SWITCH_REQUIRED')
    pushIf(reasons, evidence.providerReceiptIds.length < 1, 'DEX_CANARY_PROVIDER_RECEIPT_REQUIRED')
    pushIf(reasons, evidence.onchainSignatureIds.length !== 1, 'DEX_CANARY_ONCHAIN_SIGNATURE_REQUIRED')
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

export function certifyDexExecutionLadder(input: {
  stages: readonly DexExecutionStageEvidence[]
}): DexExecutionLadderReport {
  const byStage = new Map<DexExecutionStage, DexExecutionStageEvidence>()
  const reasons: string[] = []

  for (const evidence of input.stages) {
    if (byStage.has(evidence.stage)) reasons.push(`DEX_STAGE_DUPLICATE:${evidence.stage}`)
    else byStage.set(evidence.stage, evidence)
  }

  const missingStages = ORDER.filter((stage) => !byStage.has(stage))
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
  const controlledLiveCanaryCertified = canary?.passed === true && canary.operationalEvidence === true
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
    reportId: `dex-4stage:${hash({ stages: stable, missingStages, reasons: uniqueReasons })}`,
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
