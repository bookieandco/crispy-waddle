export type LiquiditySnapshot = {
  observedAt: string
  liquidityUsd: number
  source: string
  evidenceId: string
}

export type LiquidityHistory = {
  snapshots: LiquiditySnapshot[]
  initialLiquidityUsd: number
  currentLiquidityUsd: number
  peakLiquidityUsd: number
  drawdownFromPeak: number
  drainRate: number
  drainAcceleration: number
  stabilityScore: number
  evidenceIds: string[]
}

function assertTimestamp(value: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error('Invalid liquidity observation timestamp.')
}

function clamp(value: number): number { return Math.max(0, Math.min(1, value)) }

export function deriveLiquidityHistory(snapshots: LiquiditySnapshot[]): LiquidityHistory {
  if (!snapshots.length) throw new Error('At least one liquidity snapshot is required.')
  const ordered = [...snapshots].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  ordered.forEach((s) => {
    assertTimestamp(s.observedAt)
    if (!Number.isFinite(s.liquidityUsd) || s.liquidityUsd < 0) throw new Error('Liquidity must be a finite non-negative number.')
    if (!s.evidenceId) throw new Error('Liquidity snapshots require evidence IDs.')
  })
  const initial = ordered[0].liquidityUsd
  const current = ordered[ordered.length - 1].liquidityUsd
  const peak = Math.max(...ordered.map((s) => s.liquidityUsd))
  const drawdownFromPeak = peak > 0 ? clamp((peak - current) / peak) : 0

  const changes = ordered.slice(1).map((s, i) => {
    const previous = ordered[i]
    return previous.liquidityUsd > 0 ? (previous.liquidityUsd - s.liquidityUsd) / previous.liquidityUsd : 0
  })
  const drainRate = changes.length ? clamp(Math.max(0, ...changes)) : 0
  const last = changes.at(-1) ?? 0
  const prior = changes.length > 1 ? changes.at(-2)! : 0
  const drainAcceleration = clamp(Math.max(0, last - prior))
  const negativeMoves = changes.filter((x) => x > 0).length
  const stabilityScore = clamp(1 - (negativeMoves / Math.max(1, changes.length)) * 0.7 - drawdownFromPeak * 0.3)

  return {
    snapshots: ordered,
    initialLiquidityUsd: initial,
    currentLiquidityUsd: current,
    peakLiquidityUsd: peak,
    drawdownFromPeak,
    drainRate,
    drainAcceleration,
    stabilityScore,
    evidenceIds: [...new Set(ordered.map((s) => s.evidenceId))],
  }
}
