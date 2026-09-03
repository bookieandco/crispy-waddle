import type { WalletClusterObservation } from './wallet-cluster-intelligence'

export type MeteoraAdversarialSignal = {
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
    | 'MIGRATION_BEHAVIOR'
    | 'DESTINATION_CONVERGENCE'
  score: number
  confidence: number
  evidenceIds: string[]
  observedAt: string
  poolAddress: string
  actorIds?: string[]
}

export type WalletMeteoraAdversarialAssessment = {
  tokenMint: string
  clusterId: string
  poolAddress: string
  adversarialScore: number
  confidence: number
  signals: Array<{
    source: 'WALLET_CLUSTER' | 'METEORA'
    kind: string
    contribution: number
    confidence: number
    evidenceIds: string[]
  }>
  rationale: string[]
  evidenceIds: string[]
  blocked: boolean
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function weightedContribution(score: number, confidence: number): number {
  return clamp(score) * clamp(confidence)
}

/**
 * Fuses independent wallet-coordination evidence with Meteora liquidity-control
 * evidence. This is an intelligence assessment only: it cannot authorize trades.
 */
export function fuseWalletClusterWithMeteoraSignals(
  cluster: WalletClusterObservation,
  signals: MeteoraAdversarialSignal[],
): WalletMeteoraAdversarialAssessment[] {
  const relevant = signals.filter(signal => signal.poolAddress.length > 0)
  if (relevant.length === 0) return []

  const clusterContribution = weightedContribution(cluster.confidence, Math.min(1, cluster.wallets.length / 5))
  const results = new Map<string, WalletMeteoraAdversarialAssessment>()

  for (const signal of relevant) {
    const meteoraContribution = weightedContribution(signal.score, signal.confidence)
    const synergy = cluster.wallets.some(wallet => signal.actorIds?.includes(wallet))
      ? 0.2
      : signal.kind === 'COORDINATED_WITHDRAWAL' || signal.kind === 'DESTINATION_CONVERGENCE'
        ? 0.1
        : 0
    const adversarialScore = clamp(0.45 * clusterContribution + 0.45 * meteoraContribution + synergy)
    const confidence = clamp((cluster.confidence + signal.confidence) / 2)
    const evidenceIds = [...new Set([...cluster.evidenceIds, ...signal.evidenceIds])]
    const rationale = [
      `Wallet cluster confidence ${cluster.confidence.toFixed(2)} across ${cluster.wallets.length} wallets.`,
      `Meteora ${signal.kind} signal score ${signal.score.toFixed(2)} with confidence ${signal.confidence.toFixed(2)}.`,
    ]
    if (synergy > 0) rationale.push('Wallet participation overlaps the liquidity-control pattern or the pattern is explicitly coordination-oriented.')

    results.set(signal.poolAddress, {
      tokenMint: cluster.tokenMint,
      clusterId: cluster.clusterId,
      poolAddress: signal.poolAddress,
      adversarialScore,
      confidence,
      signals: [
        {
          source: 'WALLET_CLUSTER',
          kind: cluster.hypothesis,
          contribution: clusterContribution,
          confidence: cluster.confidence,
          evidenceIds: cluster.evidenceIds,
        },
        {
          source: 'METEORA',
          kind: signal.kind,
          contribution: meteoraContribution,
          confidence: signal.confidence,
          evidenceIds: signal.evidenceIds,
        },
      ],
      rationale,
      evidenceIds,
      blocked: false,
    })
  }

  return [...results.values()].sort((a, b) => b.adversarialScore - a.adversarialScore)
}

/** Convert the fused result into an explicit risk-gate recommendation without creating execution authority. */
export function classifyWalletMeteoraAdversarialRisk(
  assessment: WalletMeteoraAdversarialAssessment,
): 'LOW' | 'REVIEW' | 'HIGH' {
  if (assessment.adversarialScore >= 0.75 && assessment.confidence >= 0.7) return 'HIGH'
  if (assessment.adversarialScore >= 0.4) return 'REVIEW'
  return 'LOW'
}
