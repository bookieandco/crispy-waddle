import type { WalletClusterObservation } from './wallet-cluster-intelligence'

export type DlmmWithdrawalObservation = {
  eventId: string
  signature: string
  poolAddress: string
  tokenMint: string
  observedAt: string
  positionAddress: string
  ownerId?: string
  operatorId?: string
  removedBps: number
  oneSided: boolean
  positionClosed: boolean
  rebalanceBeforeWithdrawal: boolean
  destinationIds?: string[]
  evidenceIds: string[]
  confidence: number
}

export type MeteoraLiquidityControlInput = {
  poolAddress: string
  tokenMint: string
  withdrawals: DlmmWithdrawalObservation[]
  positionCount?: number
  ownerPositionCount?: number
  launchObservedAt?: string
  clusters?: WalletClusterObservation[]
}

export type MeteoraLiquidityControlSignal = {
  signalId: string
  kind:
    | 'OWNER_CONCENTRATION'
    | 'POSITION_CONCENTRATION'
    | 'RAPID_WITHDRAWAL'
    | 'ONE_SIDED_WITHDRAWAL'
    | 'COORDINATED_WITHDRAWAL'
    | 'REBALANCE_BEFORE_WITHDRAWAL'
    | 'POSITION_CLOSURE'
    | 'LAUNCH_WINDOW_LIQUIDITY'
    | 'DESTINATION_CONVERGENCE'
  score: number
  confidence: number
  observedAt: string
  poolAddress: string
  tokenMint: string
  actorIds: string[]
  evidenceIds: string[]
  explanation: string
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

function validConfidence(value: number): number {
  return Number.isFinite(value) ? clamp(value) : 0
}

function signal(
  input: MeteoraLiquidityControlInput,
  kind: MeteoraLiquidityControlSignal['kind'],
  score: number,
  confidence: number,
  withdrawal: DlmmWithdrawalObservation | undefined,
  explanation: string,
  extraEvidence: string[] = [],
): MeteoraLiquidityControlSignal {
  const evidenceIds = [...new Set([
    ...input.withdrawals.flatMap(item => item.evidenceIds),
    ...extraEvidence,
  ])]
  const actorIds = [...new Set(input.withdrawals.flatMap(item => [item.ownerId, item.operatorId].filter(Boolean) as string[]))]
  return {
    signalId: `meteora-control:${input.poolAddress}:${kind}:${withdrawal?.eventId ?? 'pool'}`,
    kind,
    score: clamp(score),
    confidence: validConfidence(confidence),
    observedAt: withdrawal?.observedAt ?? input.withdrawals[0]?.observedAt ?? new Date(0).toISOString(),
    poolAddress: input.poolAddress,
    tokenMint: input.tokenMint,
    actorIds,
    evidenceIds,
    explanation,
  }
}

/**
 * Derives defensive liquidity-control signals from already reconstructed DLMM
 * state. It deliberately does not infer intent or ownership as fact.
 */
export function deriveMeteoraLiquidityControlSignals(
  input: MeteoraLiquidityControlInput,
): MeteoraLiquidityControlSignal[] {
  const withdrawals = input.withdrawals.filter(item =>
    item.poolAddress === input.poolAddress && item.tokenMint === input.tokenMint &&
    item.removedBps >= 0 && item.removedBps <= 10_000 && validConfidence(item.confidence) > 0,
  )
  if (withdrawals.length === 0) return []

  const signals: MeteoraLiquidityControlSignal[] = []

  if (input.positionCount && input.positionCount > 0 && input.ownerPositionCount !== undefined) {
    const concentration = clamp(input.ownerPositionCount / input.positionCount)
    if (concentration >= 0.5) {
      signals.push(signal(input, 'OWNER_CONCENTRATION', concentration, 0.85, undefined,
        `One owner/operator controls ${Math.round(concentration * 100)}% of observed positions.`))
    }
  }

  const largest = Math.max(...withdrawals.map(item => item.removedBps))
  if (largest >= 7_500) {
    const withdrawal = withdrawals.find(item => item.removedBps === largest)
    signals.push(signal(input, 'RAPID_WITHDRAWAL', largest / 10_000, withdrawal?.confidence ?? 0,
      withdrawal, `A reconstructed position withdrawal removed ${Math.round(largest / 100)}% of liquidity.`))
  }

  for (const withdrawal of withdrawals.filter(item => item.oneSided)) {
    signals.push(signal(input, 'ONE_SIDED_WITHDRAWAL', withdrawal.removedBps / 10_000, withdrawal.confidence,
      withdrawal, 'Liquidity was removed from a one-sided/ranged position; this is treated as a control signal, not proof of malicious intent.'))
  }

  for (const withdrawal of withdrawals.filter(item => item.rebalanceBeforeWithdrawal)) {
    signals.push(signal(input, 'REBALANCE_BEFORE_WITHDRAWAL', 0.7, withdrawal.confidence,
      withdrawal, 'A position rebalance preceded a liquidity withdrawal in the reconstructed lifecycle.'))
  }

  for (const withdrawal of withdrawals.filter(item => item.positionClosed)) {
    signals.push(signal(input, 'POSITION_CLOSURE', withdrawal.removedBps / 10_000, withdrawal.confidence,
      withdrawal, 'The withdrawal was followed by reconstructed position closure.'))
  }

  const times = withdrawals.map(item => Date.parse(item.observedAt)).filter(Number.isFinite).sort((a, b) => a - b)
  if (times.length >= 2 && times[times.length - 1] - times[0] <= 5 * 60 * 1000) {
    const actors = [...new Set(withdrawals.flatMap(item => [item.ownerId, item.operatorId].filter(Boolean) as string[]))]
    if (actors.length >= 2) {
      signals.push(signal(input, 'COORDINATED_WITHDRAWAL', clamp(actors.length / 5),
        Math.min(...withdrawals.map(item => item.confidence)), undefined,
        `${actors.length} distinct actors withdrew liquidity within a five-minute observation window.`))
    }
  }

  const destinations = [...new Set(withdrawals.flatMap(item => item.destinationIds ?? []))]
  if (destinations.length > 0 && withdrawals.length >= 2) {
    const destinationCoverage = withdrawals.filter(item => (item.destinationIds ?? []).some(id => destinations.includes(id))).length / withdrawals.length
    if (destinationCoverage >= 0.75) {
      signals.push(signal(input, 'DESTINATION_CONVERGENCE', destinationCoverage,
        Math.min(...withdrawals.map(item => item.confidence)), undefined,
        'Multiple withdrawals converge on a shared observed destination.'))
    }
  }

  if (input.launchObservedAt) {
    const launch = Date.parse(input.launchObservedAt)
    const early = withdrawals.filter(item => Math.abs(Date.parse(item.observedAt) - launch) <= 30 * 60 * 1000)
    if (early.length > 0) {
      signals.push(signal(input, 'LAUNCH_WINDOW_LIQUIDITY', clamp(early.length / Math.max(1, withdrawals.length)),
        Math.min(...early.map(item => item.confidence)), early[0],
        'Liquidity-control activity occurred inside the launch observation window.'))
    }
  }

  // Cluster evidence strengthens coordination only when it overlaps the actors.
  for (const cluster of input.clusters ?? []) {
    const actorSet = new Set(withdrawals.flatMap(item => [item.ownerId, item.operatorId].filter(Boolean) as string[]))
    const overlap = cluster.wallets.filter(wallet => actorSet.has(wallet)).length
    if (overlap >= 2) {
      signals.push(signal(input, 'COORDINATED_WITHDRAWAL',
        clamp(0.5 + overlap / Math.max(10, cluster.wallets.length)),
        Math.min(cluster.confidence, ...withdrawals.map(item => item.confidence)),
        undefined,
        `Wallet cluster ${cluster.clusterId} overlaps ${overlap} liquidity-control actors.`,
        cluster.evidenceIds))
    }
  }

  return signals.sort((a, b) => b.score * b.confidence - a.score * a.confidence)
}
