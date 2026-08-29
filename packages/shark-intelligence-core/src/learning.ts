import type { SharkOpportunityDecision, SharkStreetSignal } from './index.js'

export type SharkOutcome = {
  decisionId: string
  opportunityId: string
  observedAt: string
  outcome: 'win' | 'loss' | 'flat' | 'invalidated'
  realizedReturnPct: number
  peakReturnPct?: number
  maxDrawdownPct?: number
  holdingPeriodMinutes?: number
  notes?: string
}

export type SharkFeatureStats = {
  feature: string
  observations: number
  wins: number
  losses: number
  flats: number
  invalidated: number
  winRate: number
  meanReturnPct: number
  meanDrawdownPct: number
}

export type SharkLearningSnapshot = {
  observations: number
  wins: number
  losses: number
  flats: number
  invalidated: number
  winRate: number
  meanReturnPct: number
  meanDrawdownPct: number
  featureStats: SharkFeatureStats[]
  updatedAt: string
  version: string
}

const EPSILON = 1e-9

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function safeNumber(value: number | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0
}

function featureNames(decision: SharkOpportunityDecision): string[] {
  const names = new Set<string>()
  for (const signal of decision.streetSignals) names.add(`street:${signal.name}`)
  for (const risk of decision.risks) names.add(`risk:${risk}`)
  names.add(`kind:${decision.kind}`)
  names.add(`decision:${decision.decision}`)
  return [...names]
}

/**
 * Records an outcome as immutable evidence for future scoring.
 * This function never mutates a decision and never authorizes execution.
 */
export function recordSharkOutcome(
  decision: SharkOpportunityDecision,
  outcome: SharkOutcome,
): SharkOutcome {
  if (outcome.decisionId !== decision.id) {
    throw new Error('outcome.decisionId must match decision.id')
  }
  if (outcome.opportunityId !== decision.opportunityId) {
    throw new Error('outcome.opportunityId must match decision.opportunityId')
  }
  if (!Number.isFinite(outcome.realizedReturnPct)) {
    throw new Error('outcome.realizedReturnPct must be finite')
  }
  return { ...outcome, realizedReturnPct: safeNumber(outcome.realizedReturnPct) }
}

/**
 * Builds descriptive statistics from prior decisions and observed outcomes.
 * The statistics are deliberately descriptive: callers must still pass through
 * Shark policy and human authorization before any execution could occur.
 */
export function buildSharkLearningSnapshot(
  records: Array<{ decision: SharkOpportunityDecision; outcome: SharkOutcome }>,
  version = 'shark-learning-v1',
): SharkLearningSnapshot {
  const wins = records.filter(({ outcome }) => outcome.outcome === 'win').length
  const losses = records.filter(({ outcome }) => outcome.outcome === 'loss').length
  const flats = records.filter(({ outcome }) => outcome.outcome === 'flat').length
  const invalidated = records.filter(({ outcome }) => outcome.outcome === 'invalidated').length
  const returns = records.map(({ outcome }) => safeNumber(outcome.realizedReturnPct))
  const drawdowns = records.map(({ outcome }) => safeNumber(outcome.maxDrawdownPct))

  const byFeature = new Map<string, Array<{ outcome: SharkOutcome }>>()
  for (const record of records) {
    for (const feature of featureNames(record.decision)) {
      const bucket = byFeature.get(feature) ?? []
      bucket.push(record)
      byFeature.set(feature, bucket)
    }
  }

  const featureStats: SharkFeatureStats[] = [...byFeature.entries()]
    .map(([feature, bucket]) => {
      const featureWins = bucket.filter(({ outcome }) => outcome.outcome === 'win').length
      const featureLosses = bucket.filter(({ outcome }) => outcome.outcome === 'loss').length
      const featureFlats = bucket.filter(({ outcome }) => outcome.outcome === 'flat').length
      const featureInvalidated = bucket.filter(({ outcome }) => outcome.outcome === 'invalidated').length
      const denominator = featureWins + featureLosses + featureFlats
      return {
        feature,
        observations: bucket.length,
        wins: featureWins,
        losses: featureLosses,
        flats: featureFlats,
        invalidated: featureInvalidated,
        // Laplace smoothing prevents one lucky observation from becoming certainty.
        winRate: (featureWins + 1) / (denominator + 2 + EPSILON),
        meanReturnPct: mean(bucket.map(({ outcome }) => safeNumber(outcome.realizedReturnPct))),
        meanDrawdownPct: mean(bucket.map(({ outcome }) => safeNumber(outcome.maxDrawdownPct))),
      }
    })
    .sort((a, b) => b.observations - a.observations || a.feature.localeCompare(b.feature))

  return {
    observations: records.length,
    wins,
    losses,
    flats,
    invalidated,
    winRate: (wins + 1) / (wins + losses + flats + 2 + EPSILON),
    meanReturnPct: mean(returns),
    meanDrawdownPct: mean(drawdowns),
    featureStats,
    updatedAt: new Date().toISOString(),
    version,
  }
}

/**
 * Returns bounded evidence-weighting adjustments for a future scorer.
 * It does not produce a trade instruction or bypass policy.
 */
export function learningAdjustment(
  snapshot: SharkLearningSnapshot,
  decision: SharkOpportunityDecision,
): number {
  const relevant = snapshot.featureStats.filter((stat) =>
    featureNames(decision).includes(stat.feature),
  )
  if (relevant.length === 0) return 0

  const weightedDelta = mean(relevant.map((stat) => stat.winRate - 0.5))
  return Math.max(-0.2, Math.min(0.2, weightedDelta))
}
