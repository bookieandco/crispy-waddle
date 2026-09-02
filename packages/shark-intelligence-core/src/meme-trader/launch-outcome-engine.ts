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
  liquidityHistory?: Pick<LiquidityHistory, 'initialLiquidityUsd' | 'currentLiquidityUsd' | 'peakLiquidityUsd' | 'drawdownFromPeak' | 'drainRate' | 'drainAcceleration' | 'evidenceIds'>
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
  version: 'launch-outcome-v1'
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
  let rugSignals = 0
  let healthySignals = 0
  let pumpDumpSignals = 0

  if (input.liquidityRemoved === true) { rugSignals += 3; reasons.push('liquidity-removal-observed') }
  if (input.tradingHalted === true) { rugSignals += 2; reasons.push('trading-halted') }
  if (finite(history?.drawdownFromPeak) && history!.drawdownFromPeak >= 0.8) { rugSignals += 2; reasons.push('severe-liquidity-peak-drawdown') }
  if (finite(history?.drainRate) && history!.drainRate >= 0.5) { rugSignals += 2; reasons.push('extreme-liquidity-drain') }
  if (finite(input.developerSoldPct) && input.developerSoldPct >= 0.5) { rugSignals += 2; reasons.push('developer-distribution-observed') }
  if (finite(input.holderExitPct) && input.holderExitPct >= 0.7) { rugSignals += 1; reasons.push('holder-exit-is-extreme') }

  if (finite(input.holderCountChangePct) && input.holderCountChangePct >= 25) { healthySignals += 1; reasons.push('holder-base-expanded') }
  if (finite(history?.stabilityScore) && history!.stabilityScore >= 0.8) { healthySignals += 2; reasons.push('liquidity-remained-stable') }
  if (finite(input.priceReturnFromLaunchPct) && input.priceReturnFromLaunchPct >= 100 && !input.liquidityRemoved) { healthySignals += 1; reasons.push('positive-price-retention-without-observed-liquidity-removal') }
  if (input.holderBehavior === 'ACCUMULATING') { healthySignals += 1; reasons.push('holders-accumulating') }
  if (input.holderBehavior === 'PANIC_EXIT') { pumpDumpSignals += 2; reasons.push('panic-exit-behavior') }
  if (finite(input.peakReturnPct) && input.peakReturnPct >= 100 && finite(input.priceReturnFromLaunchPct) && input.priceReturnFromLaunchPct <= 10 && !input.liquidityRemoved) { pumpDumpSignals += 2; reasons.push('large-run-up-followed-by-near-baseline-return') }
  if (finite(input.maxDrawdownPct) && input.maxDrawdownPct >= 0.8 && !input.liquidityRemoved) { pumpDumpSignals += 1; reasons.push('extreme-price-drawdown') }

  let outcome: LaunchOutcome = 'UNKNOWN'
  if (rugSignals >= 3) outcome = 'RUG'
  else if (pumpDumpSignals >= 2 && healthySignals < 2) outcome = 'PUMP_AND_DUMP'
  else if (healthySignals >= 2 && rugSignals === 0) outcome = 'HEALTHY'
  else if (finite(input.priceReturnFromLaunchPct) && input.priceReturnFromLaunchPct <= -80 && (input.holderExitPct ?? 0) >= 0.5) outcome = 'FAILED'

  const observedSignals = rugSignals + healthySignals + pumpDumpSignals
  const confidence = clamp(observedSignals / 6)
  if (outcome === 'UNKNOWN') reasons.push('insufficient-deterministic-evidence-for-outcome-label')
  return { outcome, confidence, reasons, evidenceIds: [...evidenceIds], evaluatedAt: input.evaluatedAt, version: 'launch-outcome-v1' }
}

export function applyLaunchOutcome(launch: TokenLaunch, assessment: LaunchOutcomeAssessment): TokenLaunch {
  if (assessment.outcome === 'UNKNOWN') return launch
  if (launch.outcome !== 'UNKNOWN' && launch.outcome !== assessment.outcome) {
    throw new Error(`Conflicting launch outcome labels for ${launch.launchId}: ${launch.outcome} vs ${assessment.outcome}.`)
  }
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
  return {
    actorId,
    launches: launches.length,
    healthyLaunches,
    badLaunches,
    failedLaunches,
    rugRate: launches.length ? launches.filter(x => x.outcome === 'RUG').length / launches.length : 0,
    pumpAndDumpRate: launches.length ? launches.filter(x => x.outcome === 'PUMP_AND_DUMP').length / launches.length : 0,
    outcomeCoverage: launches.length ? labeled.length / launches.length : 0,
    confidence: clamp(labeled.length / 10),
    evidenceIds,
  }
}
