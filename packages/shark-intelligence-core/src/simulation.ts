import type { SharkOpportunityDecision } from './index.js'

export type SharkSimulationPoint = {
  observedAt: string
  price: number
}

export type SharkSimulationConfig = {
  initialCapital: number
  positionFraction: number
  entryFeePct?: number
  exitFeePct?: number
  slippagePct?: number
}

export type SharkSimulationTrade = {
  decisionId: string
  opportunityId: string
  entryPrice: number
  exitPrice: number
  positionSize: number
  grossReturnPct: number
  netReturnPct: number
  pnl: number
  holdingPeriodMinutes: number
  outcome: 'win' | 'loss' | 'flat'
}

function finitePositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`)
  return value
}

function pct(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value as number) / 100 : 0
}

/**
 * Deterministic paper-trade simulation. It consumes observed prices only;
 * it never creates, signs, submits, or authorizes a real transaction.
 */
export function simulateSharkTrade(
  decision: SharkOpportunityDecision,
  points: SharkSimulationPoint[],
  config: SharkSimulationConfig,
): SharkSimulationTrade {
  if (points.length < 2) throw new Error('at least two price points are required')
  const capital = finitePositive(config.initialCapital, 'initialCapital')
  const fraction = config.positionFraction
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    throw new Error('positionFraction must be between 0 and 1')
  }

  const entry = finitePositive(points[0].price, 'entry price')
  const exit = finitePositive(points[points.length - 1].price, 'exit price')
  const entryFee = pct(config.entryFeePct)
  const exitFee = pct(config.exitFeePct)
  const slippage = pct(config.slippagePct)
  const positionSize = capital * fraction

  const effectiveEntry = entry * (1 + slippage)
  const effectiveExit = exit * (1 - slippage)
  const grossReturnPct = ((effectiveExit / effectiveEntry) - 1) * 100
  const netReturnPct = grossReturnPct - (entryFee + exitFee) * 100
  const pnl = positionSize * (netReturnPct / 100)
  const holdingPeriodMinutes = Math.max(
    0,
    (new Date(points[points.length - 1].observedAt).getTime() -
      new Date(points[0].observedAt).getTime()) /
      60000,
  )

  return {
    decisionId: decision.id,
    opportunityId: decision.opportunityId,
    entryPrice: entry,
    exitPrice: exit,
    positionSize,
    grossReturnPct,
    netReturnPct,
    pnl,
    holdingPeriodMinutes,
    outcome: netReturnPct > 0 ? 'win' : netReturnPct < 0 ? 'loss' : 'flat',
  }
}
