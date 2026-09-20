import type { LaunchOutcome, TokenLaunch } from './wallet-launch-pipeline'
import type { LiquidityHistory } from './liquidity-history'

export type LaunchOutcomeEvidence = {
  evidenceId: string
  observedAt: string
  kind: 'price' | 'liquidity' | 'holder' | 'developer' | 'transaction'
  value?: number
  label: string
}

export type LaunchOutcomeInput = {
  launch: TokenLaunch
  evaluatedAt: string
  priceReturnFromLaunchPct?: number
  peakReturnPct?: number
  maxDrawdownPct?: number
  liquidityHistory?: Pick<LiquidityHistory, 'initialLiquidityUsd' | 'currentLiquidityUsd' | 'peakLiquidityUsd' | 'drawdownFromPeak' | 'drainRate' | 'drainAcceleration' | 'stabilityScore' | 'evidenceIds'>
  holderCountChangePct?: number
  holderExitPct?: number
  developerSoldPct?: number
  liquidityRemoved?: boolean
  tradingHalted?: boolean
  holderBehavior?: 'ACCUMULATING' | 'STABLE' | 'DISTRIBUTING' | 'PANIC_EXIT'
  evidence: LaunchOutcomeEvidence[]
}

export type LaunchOutcomeAssessment = {
  outcome: LaunchOutcome
  confidence: number
  reasons: string[]
  evidenceIds: string[]
  evaluatedAt: string
  version: 'launch-outcome-v2'
}

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function evaluateLaunchOutcome(input: LaunchOutcomeInput): LaunchOutcomeAssessment {
  if (!input.launch.launchId || !input.launch.tokenAddress) throw new Error('Launch outcome requires a valid launch identity.')
  if (!input.evaluatedAt || Number.isNaN(Date.parse(input.evaluatedAt))) throw new Error('Invalid outcome evaluation timestamp.')

  const reasons: string[] = []
  const evidenceIds = new Set(input.evidence.map(e => e.evidenceId))
  input.liquidityHistory?.evidenceIds.forEach(id => evidenceIds.add(id))
  const history = input.liquidityHistory

  const explicitLiquidityRemoval = input.liquidityRemoved === true
  const severeLiquidityCollapse = finite(history?.drawdownFromPeak) && history!.drawdownFromPeak >= 0.8
  const extremeLiquidityDrain = finite(history?.drainRate) && history!.drainRate >= 0.5
  const developerDistribution = finite(input.developerSoldPct) && input.developerSoldPct >= 0.5
  const extremeHolderExit = finite(input.holderExitPct) && input.holderExitPct >= 0.7
  const panicExit = input.holderBehavior === 'PANIC_EXIT'
  const runUpThenCollapse = finite(input.peakReturnPct) && input.peakReturnPct >= 100 &&
    finite(input.priceReturnFromLaunchPct) && input.priceReturnFromLaunchPct <= 10
  const extremePriceCollapse = finite(input.priceReturnFromLaunchPct) && input.priceReturnFromLaunchPct <= -80
  const extremeDrawdown = finite(input.maxDrawdownPct) && input.maxDrawdownPct >= 0.8
  const stableLiquidity = finite(history?.stabilityScore) && history!.stabilityScore >= 0.8

  if (explicitLiquidityRemoval) reasons.push('liquidity-removal-observed')
  if (input.tradingHalted === true) reasons.push('trading-halted')
  if (severeLiquidityCollapse) reasons.push('severe-liquidity-peak-drawdown')
  if (extremeLiquidityDrain) reasons.push('extreme-liquidity-drain')
  if (developerDistribution) reasons.push('developer-distribution-observed')
  if (extremeHolderExit) reasons.push('holder-exit-is-extreme')
  if (panicExit) reasons.push('panic-exit-behavior')
  if (runUpThenCollapse) reasons.push('large-run-up-followed-by-collapse')
  if (extremeDrawdown) reasons.push('extreme-price-drawdown')
  if (stableLiquidity) reasons.push('liquidity-remained-stable')
  if (finite(input.holderCountChangePct) && input.holderCountChangePct >= 25) reasons.push('holder-base-expanded')
  if (input.holderBehavior === 'ACCUMULATING') reasons.push('holders-accumulating')

  let outcome: LaunchOutcome = 'UNKNOWN'
  let confidence = 0

  // RUG requires direct liquidity-removal evidence or a corroborated liquidity collapse.
  // Price/developer/holder behavior alone cannot manufacture a rug label.
  if (explicitLiquidityRemoval || (severeLiquidityCollapse && extremeLiquidityDrain)) {
    outcome = 'RUG'
    confidence = explicitLiquidityRemoval ? 0.9 : 0.8
    if (input.tradingHalted === true) confidence += 0.05
    if (developerDistribution) confidence += 0.05
  } else if ((runUpThenCollapse && (panicExit || extremeDrawdown || developerDistribution)) ||
             (developerDistribution && panicExit && extremeDrawdown)) {
    outcome = 'PUMP_AND_DUMP'
    confidence = runUpThenCollapse ? 0.8 : 0.7
  } else if (extremePriceCollapse && (extremeHolderExit || panicExit)) {
    outcome = 'FAILED'
    confidence = 0.7
  } else {
    let healthySignals = 0
    if (stableLiquidity) healthySignals += 2
    if (finite(input.holderCountChangePct) && input.holderCountChangePct >= 25) healthySignals += 1
    if (finite(input.priceReturnFromLaunchPct) && input.priceReturnFromLaunchPct >= 100) healthySignals += 1
    if (input.holderBehavior === 'ACCUMULATING') healthySignals += 1
    if (healthySignals >= 2) {
      outcome = 'HEALTHY'
      confidence = clamp(healthySignals / 5)
    }
  }

  if (outcome === 'UNKNOWN') {
    const observed = [
      input.priceReturnFromLaunchPct, input.peakReturnPct, input.maxDrawdownPct,
      history?.drawdownFromPeak, history?.drainRate, history?.stabilityScore,
      input.holderCountChangePct, input.holderExitPct, input.developerSoldPct,
    ].filter(finite).length + (input.liquidityRemoved !== undefined ? 1 : 0) + (input.tradingHalted !== undefined ? 1 : 0)
    confidence = clamp(observed / 10)
    reasons.push('insufficient-deterministic-evidence-for-outcome-label')
  }

  return { outcome, confidence: clamp(confidence), reasons, evidenceIds: [...evidenceIds], evaluatedAt: input.evaluatedAt, version: 'launch-outcome-v2' }
}

export function applyLaunchOutcome(launch: TokenLaunch, assessment: LaunchOutcomeAssessment): TokenLaunch {
  if (assessment.outcome === 'UNKNOWN') return launch
  if (launch.outcomeObservedAt && Date.parse(assessment.evaluatedAt) < Date.parse(launch.outcomeObservedAt)) return launch
  return {
    ...launch,
    outcome: assessment.outcome,
    outcomeObservedAt: assessment.evaluatedAt,
    evidenceIds: [...new Set([...launch.evidenceIds, ...assessment.evidenceIds])],
  }
}

export type ActorOutcomeHistory = {
  actorId: string
  launches: number
  healthyLaunches: number
  badLaunches: number
  failedLaunches: number
  rugRate: number
  pumpAndDumpRate: number
  outcomeCoverage: number
  confidence: number
  evidenceIds: string[]
}

export function deriveActorOutcomeHistory(actorId: string, launches: TokenLaunch[]): ActorOutcomeHistory {
  if (!actorId) throw new Error('Actor history requires an actor ID.')
  const labeled = launches.filter(x => x.outcome !== 'UNKNOWN')
  const healthyLaunches = launches.filter(x => x.outcome === 'HEALTHY').length
  const badLaunches = launches.filter(x => x.outcome === 'RUG' || x.outcome === 'PUMP_AND_DUMP').length
  const failedLaunches = launches.filter(x => x.outcome === 'FAILED').length
  const evidenceIds = [...new Set(launches.flatMap(x => x.evidenceIds))]
  return { actorId, launches: launches.length, healthyLaunches, badLaunches, failedLaunches, rugRate: launches.length ? launches.filter(x => x.outcome === 'RUG').length / launches.length : 0, pumpAndDumpRate: launches.length ? launches.filter(x => x.outcome === 'PUMP_AND_DUMP').length / launches.length : 0, outcomeCoverage: launches.length ? labeled.length / launches.length : 0, confidence: clamp(labeled.length / 10), evidenceIds }
}
