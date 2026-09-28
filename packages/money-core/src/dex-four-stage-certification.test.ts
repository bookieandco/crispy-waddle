import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertDexControlledLiveCanaryCertified,
  certifyDexExecutionLadder,
  certifyDexExecutionStage,
  type DexExecutionStageEvidence,
  type Edge007IntegrityReceipt,
} from './dex-four-stage-certification.js'

const integrity = (overrides: Partial<Edge007IntegrityReceipt> = {}): Edge007IntegrityReceipt => ({
  guardVersion: 'EDGE-007-v1',
  guardId: 'edge007-pass-1',
  disposition: 'PASS',
  reasonCodes: [],
  evidenceIds: ['edge007:evidence:1'],
  authority: 'INTEGRITY_VETO_ONLY',
  canAuthorizeTrade: false,
  canAuthorizePromotion: false,
  ...overrides,
})

const stage = (
  stageName: DexExecutionStageEvidence['stage'],
  overrides: Partial<DexExecutionStageEvidence> = {},
): DexExecutionStageEvidence => {
  const windows = {
    HISTORICAL_REPLAY: ['2026-09-27T19:00:00.000Z', '2026-09-27T19:10:00.000Z'],
    LIVE_SHADOW: ['2026-09-27T19:11:00.000Z', '2026-09-27T19:21:00.000Z'],
    SIGNED_SIMULATION_NO_BROADCAST: ['2026-09-27T19:22:00.000Z', '2026-09-27T19:32:00.000Z'],
    CONTROLLED_LIVE_CANARY: ['2026-09-27T19:33:00.000Z', '2026-09-27T19:43:00.000Z'],
  } as const
  const [startedAt, endedAt] = windows[stageName]
  const base: DexExecutionStageEvidence = {
    stageId: 'stage:' + stageName,
    stage: stageName,
    origin: 'SYNTHETIC_TEST',
    runLineageId: 'lineage:shark-canary-1',
    strategyId: 'shark:meme:v1',
    instrumentId: 'solana:TOKEN1',
    startedAt,
    endedAt,
    informationCutoff: endedAt,
    integrityGuard: integrity(),
    decisionCount: 1,
    signedTransactionCount: 0,
    simulationCount: 0,
    simulationFailureCount: 0,
    broadcastCount: 0,
    entryBroadcastCount: 0,
    exitBroadcastCount: 0,
    reconciledBroadcastCount: 0,
    duplicateBroadcastCount: 0,
    unknownExecutionCount: 0,
    futureEvidenceCount: 0,
    signerBoundary: 'NOT_APPLICABLE',
    privateKeyMaterialObserved: false,
    capitalBounded: false,
    killSwitchProven: false,
    restartRecoveryProven: false,
    sellabilityProven: false,
    positionFlatAfterExit: false,
    executionCostReconciled: false,
    providerReceiptIds: [],
    onchainSignatureIds: [],
    evidenceIds: ['evidence:' + stageName],
  }

  if (stageName === 'SIGNED_SIMULATION_NO_BROADCAST') {
    Object.assign(base, {
      origin: 'LIVE_RUNTIME_ATTESTED',
      signedTransactionCount: 1,
      simulationCount: 1,
      signerBoundary: 'ISOLATED',
      walletConnectionId: 'wallet:coffer:1',
    })
  }

  return { ...base, ...overrides }
}

test('historical replay rejects future leakage and any broadcast', () => {
  const futureLeak = certifyDexExecutionStage(stage('HISTORICAL_REPLAY', { futureEvidenceCount: 1 }))
  assert.equal(futureLeak.passed, false)
  assert.ok(futureLeak.reasonCodes.includes('DEX_REPLAY_FUTURE_LEAKAGE'))

  const broadcast = certifyDexExecutionStage(stage('HISTORICAL_REPLAY', { broadcastCount: 1 }))
  assert.equal(broadcast.passed, false)
  assert.ok(broadcast.reasonCodes.includes('DEX_REPLAY_BROADCAST_FORBIDDEN'))
})

test('live shadow physically forbids signing and broadcast', () => {
  const signed = certifyDexExecutionStage(stage('LIVE_SHADOW', {
    origin: 'RECORDED_REAL_MARKET',
    signedTransactionCount: 1,
  }))
  assert.equal(signed.passed, false)
  assert.ok(signed.reasonCodes.includes('DEX_SHADOW_SIGNING_FORBIDDEN'))

  const submitted = certifyDexExecutionStage(stage('LIVE_SHADOW', {
    origin: 'RECORDED_REAL_MARKET',
    broadcastCount: 1,
  }))
  assert.equal(submitted.passed, false)
  assert.ok(submitted.reasonCodes.includes('DEX_SHADOW_BROADCAST_FORBIDDEN'))
})

test('signed simulation requires isolated signing, successful simulation, and zero broadcast', () => {
  const ok = certifyDexExecutionStage(stage('SIGNED_SIMULATION_NO_BROADCAST'))
  assert.equal(ok.passed, true)
  assert.equal(ok.operationalEvidence, true)

  const leaked = certifyDexExecutionStage(stage('SIGNED_SIMULATION_NO_BROADCAST', {
    privateKeyMaterialObserved: true,
  }))
  assert.equal(leaked.passed, false)
  assert.ok(leaked.reasonCodes.includes('DEX_PRIVATE_KEY_MATERIAL_FORBIDDEN'))

  const broadcast = certifyDexExecutionStage(stage('SIGNED_SIMULATION_NO_BROADCAST', {
    broadcastCount: 1,
  }))
  assert.equal(broadcast.passed, false)
  assert.ok(broadcast.reasonCodes.includes('DEX_SIMULATION_BROADCAST_FORBIDDEN'))
})

test('EDGE-007 blocks staged DEX certification and never grants execution authority', () => {
  const result = certifyDexExecutionStage(stage('SIGNED_SIMULATION_NO_BROADCAST', {
    integrityGuard: integrity({
      disposition: 'BLOCK',
      reasonCodes: ['EDGE007_FAKE_VOLUME_FORBIDDEN'],
    }),
  }))
  assert.equal(result.passed, false)
  assert.ok(result.reasonCodes.includes('DEX_EDGE007_BLOCKED'))
  assert.equal(result.canAuthorizeTrade, false)
})

test('controlled canary cannot be certified by synthetic evidence or without runtime reconciliation', () => {
  const result = certifyDexExecutionStage(stage('CONTROLLED_LIVE_CANARY'))
  assert.equal(result.passed, false)
  assert.equal(result.operationalEvidence, false)
  assert.ok(result.reasonCodes.includes('DEX_CANARY_LIVE_RUNTIME_ATTESTATION_REQUIRED'))
  assert.ok(result.reasonCodes.includes('DEX_CANARY_ROUND_TRIP_BROADCASTS_REQUIRED'))
  assert.ok(result.reasonCodes.includes('DEX_CANARY_ENTRY_BROADCAST_REQUIRED'))
  assert.ok(result.reasonCodes.includes('DEX_CANARY_EXIT_BROADCAST_REQUIRED'))
  assert.ok(result.reasonCodes.includes('DEX_CANARY_ROUND_TRIP_RECONCILIATION_REQUIRED'))
  assert.ok(result.reasonCodes.includes('DEX_CANARY_PROVIDER_RECEIPTS_REQUIRED'))
  assert.ok(result.reasonCodes.includes('DEX_CANARY_ONCHAIN_SIGNATURES_REQUIRED'))
  assert.ok(result.reasonCodes.includes('DEX_CANARY_RESTART_RECOVERY_REQUIRED'))
  assert.ok(result.reasonCodes.includes('DEX_CANARY_SELLABILITY_REQUIRED'))
})


test('controlled live canary requires a fully reconciled entry and exit round trip', () => {
  const evidence = stage('CONTROLLED_LIVE_CANARY', {
    origin: 'LIVE_RUNTIME_ATTESTED',
    walletConnectionId: 'wallet:coffer:1',
    entryExecutionId: 'exec:entry',
    exitExecutionId: 'exec:exit',
    signedTransactionCount: 2,
    simulationCount: 2,
    broadcastCount: 2,
    entryBroadcastCount: 1,
    exitBroadcastCount: 1,
    reconciledBroadcastCount: 2,
    signerBoundary: 'ISOLATED',
    capitalBounded: true,
    killSwitchProven: true,
    restartRecoveryProven: true,
    sellabilityProven: true,
    positionFlatAfterExit: true,
    executionCostReconciled: true,
    providerReceiptIds: ['provider:entry', 'provider:exit'],
    onchainSignatureIds: ['sig:entry', 'sig:exit'],
  })
  const result = certifyDexExecutionStage(evidence)
  assert.equal(result.passed, true)
  assert.equal(result.operationalEvidence, true)
  assert.equal(result.canAuthorizeTrade, false)

  const missingExit = certifyDexExecutionStage({ ...evidence, exitBroadcastCount: 0, broadcastCount: 1, reconciledBroadcastCount: 1, sellabilityProven: false, positionFlatAfterExit: false, onchainSignatureIds: ['sig:entry'] })
  assert.equal(missingExit.passed, false)
  assert.ok(missingExit.reasonCodes.includes('DEX_CANARY_EXIT_BROADCAST_REQUIRED'))
  assert.ok(missingExit.reasonCodes.includes('DEX_CANARY_SELLABILITY_REQUIRED'))
  assert.ok(missingExit.reasonCodes.includes('DEX_CANARY_POSITION_MUST_BE_FLAT_AFTER_EXIT'))
})

test('stages 1-3 software certify while controlled canary remains explicitly missing', () => {
  const report = certifyDexExecutionLadder({
    stages: [
      stage('HISTORICAL_REPLAY'),
      stage('LIVE_SHADOW', { origin: 'RECORDED_REAL_MARKET' }),
      stage('SIGNED_SIMULATION_NO_BROADCAST'),
    ],
  })
  assert.equal(report.softwareCertified, true)
  assert.equal(report.operationallyCertified, false)
  assert.equal(report.controlledLiveCanaryCertified, false)
  assert.deepEqual(report.missingStages, ['CONTROLLED_LIVE_CANARY'])
  assert.equal(report.unrestrictedLiveAuthorized, false)
  assert.throws(() => assertDexControlledLiveCanaryCertified(report), /DEX_CONTROLLED_LIVE_CANARY_NOT_CERTIFIED/)
})


test('ladder rejects evidence stitched across different strategies or instruments', () => {
  const report = certifyDexExecutionLadder({
    stages: [
      stage('HISTORICAL_REPLAY', { origin: 'RECORDED_REAL_MARKET' }),
      stage('LIVE_SHADOW', { origin: 'RECORDED_REAL_MARKET', strategyId: 'different-strategy' }),
      stage('SIGNED_SIMULATION_NO_BROADCAST'),
    ],
  })
  assert.equal(report.operationallyCertified, false)
  assert.ok(report.reasonCodes.includes('DEX_STAGE_LINEAGE_MISMATCH'))
})

test('overlapping stage windows fail ladder certification', () => {
  const report = certifyDexExecutionLadder({
    stages: [
      stage('HISTORICAL_REPLAY', { origin: 'RECORDED_REAL_MARKET' }),
      stage('LIVE_SHADOW', {
        origin: 'RECORDED_REAL_MARKET',
        startedAt: '2026-09-27T19:09:00.000Z',
      }),
      stage('SIGNED_SIMULATION_NO_BROADCAST'),
    ],
  })
  assert.equal(report.operationallyCertified, false)
  assert.ok(report.reasonCodes.includes('DEX_STAGE_ORDER_INVALID:HISTORICAL_REPLAY->LIVE_SHADOW'))
})
