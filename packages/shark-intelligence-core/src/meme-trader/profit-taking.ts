export type ProfitTakingReason =
  | 'target-reached'
  | 'momentum-fading'
  | 'liquidity-deteriorating'
  | 'distribution-detected'
  | 'risk-increased'
  | 'time-decay'
  | 'thesis-strengthened'

export type ProfitTakingAction = {
  fractionOfPosition: number
  reason: ProfitTakingReason
  urgency: 'normal' | 'elevated' | 'immediate'
  lockInProfit: boolean
}

export type ProfitTakingPlan = {
  enabled: boolean
  targets: number[]
  trailingStopRoi: number
  maxGivebackFromPeak: number
  actions: ProfitTakingAction[]
  remainingPositionFraction: number
  reasons: string[]
}

export type ProfitTakingState = {
  entryPrice: number
  currentPrice: number
  peakPrice: number
  liquidityUsd: number
  liquidityChangePct?: number
  momentumScore: number
  distributionScore: number
  riskScore: number
  thesisStrength: number
  secondsSinceEntry: number
}

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const finitePositive = (n: number) => Number.isFinite(n) && n > 0

/**
 * Deterministic, execution-agnostic profit-taking planner.
 * It produces a proposed reduction in position size; it never submits an order.
 * Percentages are deliberately configurable and must be calibrated by StrategyLab.
 */
export function planProfitTaking(
  state: ProfitTakingState,
  config: {
    targets?: number[]
    defaultTargetFraction?: number
    maxGivebackFromPeak?: number
    minLiquidityUsd?: number
    distributionThreshold?: number
    momentumFadeThreshold?: number
    riskThreshold?: number
    timeDecaySeconds?: number
  } = {},
): ProfitTakingPlan {
  if (!finitePositive(state.entryPrice) || !finitePositive(state.currentPrice) || !finitePositive(state.peakPrice)) {
    throw new Error('entryPrice, currentPrice, and peakPrice must be positive finite numbers')
  }

  const targets = [...(config.targets ?? [0.20, 0.40, 0.75, 1.00])]
    .filter(Number.isFinite)
    .filter((x) => x > 0)
    .sort((a, b) => a - b)

  const defaultTargetFraction = clamp(config.defaultTargetFraction ?? 0.25)
  const maxGivebackFromPeak = clamp(config.maxGivebackFromPeak ?? 0.25)
  const minLiquidityUsd = Math.max(0, config.minLiquidityUsd ?? 0)
  const distributionThreshold = clamp(config.distributionThreshold ?? 0.70)
  const momentumFadeThreshold = clamp(config.momentumFadeThreshold ?? 0.35)
  const riskThreshold = clamp(config.riskThreshold ?? 0.70)
  const timeDecaySeconds = Math.max(1, config.timeDecaySeconds ?? 120)

  const roi = state.currentPrice / state.entryPrice - 1
  const peakRoi = state.peakPrice / state.entryPrice - 1
  const giveback = peakRoi > 0 ? 1 - state.currentPrice / state.peakPrice : 0

  const actions: ProfitTakingAction[] = []
  const reasons: string[] = []

  // Take some profit as positive targets are reached. This is a proposal only.
  for (const target of targets) {
    if (roi >= target) {
      actions.push({
        fractionOfPosition: defaultTargetFraction,
        reason: 'target-reached',
        urgency: 'normal',
        lockInProfit: true,
      })
      reasons.push(`ROI target ${(target * 100).toFixed(0)}% reached.`)
      break
    }
  }

  // Preserve gains when a strong run starts reversing.
  if (peakRoi > 0 && giveback >= maxGivebackFromPeak && roi > 0) {
    actions.push({
      fractionOfPosition: 0.25,
      reason: 'momentum-fading',
      urgency: 'elevated',
      lockInProfit: true,
    })
    reasons.push(`Price gave back ${(giveback * 100).toFixed(1)}% from peak while still profitable.`)
  }

  if ((state.liquidityChangePct ?? 0) <= -25 || (minLiquidityUsd > 0 && state.liquidityUsd < minLiquidityUsd)) {
    actions.push({
      fractionOfPosition: 0.50,
      reason: 'liquidity-deteriorating',
      urgency: 'elevated',
      lockInProfit: roi > 0,
    })
    reasons.push('Exit liquidity deteriorated materially.')
  }

  if (state.distributionScore >= distributionThreshold) {
    actions.push({
      fractionOfPosition: 0.50,
      reason: 'distribution-detected',
      urgency: 'immediate',
      lockInProfit: roi > 0,
    })
    reasons.push('Tracked-wallet distribution signal crossed its configured threshold.')
  }

  if (state.riskScore >= riskThreshold) {
    actions.push({
      fractionOfPosition: roi > 0 ? 0.50 : 1,
      reason: 'risk-increased',
      urgency: 'immediate',
      lockInProfit: roi > 0,
    })
    reasons.push('Risk score crossed the configured exit threshold.')
  }

  if (state.momentumScore <= momentumFadeThreshold && roi > 0) {
    actions.push({
      fractionOfPosition: 0.25,
      reason: 'momentum-fading',
      urgency: 'elevated',
      lockInProfit: true,
    })
    reasons.push('Momentum weakened while the position remained profitable.')
  }

  if (state.secondsSinceEntry >= timeDecaySeconds && roi > 0 && state.thesisStrength < 0.5) {
    actions.push({
      fractionOfPosition: 0.25,
      reason: 'time-decay',
      urgency: 'normal',
      lockInProfit: true,
    })
    reasons.push('The trade has consumed its time budget without sufficient thesis strength.')
  }

  // If the thesis is strengthening, do not manufacture an exit merely because a target was hit.
  if (state.thesisStrength >= 0.80 && state.momentumScore >= 0.70 && state.distributionScore < 0.40 && state.riskScore < 0.50) {
    reasons.push('Strong thesis and momentum permit retaining a runner; no automatic full exit is proposed.')
  }

  const requestedFraction = actions.reduce((sum, action) => sum + action.fractionOfPosition, 0)
  const fractionToTake = clamp(requestedFraction)

  return {
    enabled: true,
    targets,
    trailingStopRoi: Math.max(0, peakRoi - maxGivebackFromPeak),
    maxGivebackFromPeak,
    actions,
    remainingPositionFraction: 1 - fractionToTake,
    reasons,
  }
}
