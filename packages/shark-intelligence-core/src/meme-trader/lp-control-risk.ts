export type LPControlRiskInput = {
  lpOwnerKnown?: boolean
  lpOwnerIsDeployer?: boolean
  lpBurnedPct?: number
  lpLockedPct?: number
  lockExpiresAt?: string
  authorityCanChange?: boolean
  withdrawalObserved?: boolean
  liquidityHistory?: { drawdownFromPeak: number; drainRate: number; drainAcceleration: number }
  evidenceIds: string[]
}

export type LPControlRisk = {
  score: number
  band: 'low' | 'medium' | 'high' | 'critical'
  controllableLiquidityPct: number
  lockExpiryRisk: number
  withdrawalRisk: number
  reasons: string[]
  evidenceIds: string[]
}

function clamp(n: number): number { return Math.max(0, Math.min(1, n)) }

export function assessLPControlRisk(input: LPControlRiskInput): LPControlRisk {
  const reasons: string[] = []
  let score = 0
  const burned = clamp(input.lpBurnedPct ?? 0) / 100
  const locked = clamp(input.lpLockedPct ?? 0) / 100
  const controllableLiquidityPct = clamp(1 - Math.max(burned, locked))

  if (input.lpOwnerKnown === false) { score += 0.15; reasons.push('lp-owner-unknown') }
  if (input.lpOwnerIsDeployer) { score += 0.2; reasons.push('deployer-controls-lp') }
  if (input.authorityCanChange) { score += 0.15; reasons.push('lp-authority-can-change') }
  if (controllableLiquidityPct > 0.5) { score += 0.2; reasons.push('substantial-lp-remains-controllable') }
  else if (controllableLiquidityPct > 0.1) { score += 0.08; reasons.push('some-lp-remains-controllable') }

  let lockExpiryRisk = 0
  if (input.lockExpiresAt) {
    const remaining = Date.parse(input.lockExpiresAt) - Date.now()
    if (Number.isFinite(remaining) && remaining <= 7 * 86400000) { lockExpiryRisk = 0.25; score += lockExpiryRisk; reasons.push('lp-lock-expiring-soon') }
  }

  let withdrawalRisk = 0
  if (input.withdrawalObserved) { withdrawalRisk = 0.5; score += withdrawalRisk; reasons.push('historical-liquidity-withdrawal-observed') }
  const history = input.liquidityHistory
  if (history) {
    if (history.drainRate > 0.25) { score += 0.3; reasons.push('rapid-liquidity-drain') }
    else if (history.drainRate > 0.1) { score += 0.12; reasons.push('elevated-liquidity-drain') }
    if (history.drainAcceleration > 0.15) { score += 0.15; reasons.push('liquidity-drain-accelerating') }
  }

  score = clamp(score)
  const band = score >= 0.75 ? 'critical' : score >= 0.5 ? 'high' : score >= 0.25 ? 'medium' : 'low'
  return { score, band, controllableLiquidityPct, lockExpiryRisk, withdrawalRisk, reasons, evidenceIds: [...new Set(input.evidenceIds)] }
}
