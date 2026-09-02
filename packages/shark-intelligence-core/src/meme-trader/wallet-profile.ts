export type WalletProfile = {
  walletId: string
  chains: string[]
  tokensPerDay: number
  tradesPerDay: number
  averageHoldTime?: number
  medianHoldTime?: number
  averageRealizedReturn?: number
  winRate?: number
  profitFactor?: number
  maxDrawdown?: number
  concentration?: number
  narrativeAffinity?: number
  newPairAffinity?: number
  migratedTokenAffinity?: number
  consistencyScore?: number
  strategyFingerprint: string[]
  evidenceIds: string[]
  observedAt: string
}

type TradeRecord = {
  realizedPnl?: number
  holdTimeSeconds?: number
  tokenAddress?: string
  marketCap?: number
  narrative?: boolean
  newPair?: boolean
  migrated?: boolean
  amountUsd?: number
}

const finite = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

const average = (values: number[]): number | undefined => values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Pure, deterministic profile derivation. Raw provider payload remains evidence; this is derived intelligence. */
export function deriveWalletProfile(input: {
  walletId: string
  chains: string[]
  trades: TradeRecord[]
  windowDays: number
  evidenceIds: string[]
  observedAt: string
}): WalletProfile {
  if (!input.walletId || !Number.isFinite(input.windowDays) || input.windowDays <= 0) throw new Error('walletId and positive windowDays are required.')
  const pnl = input.trades.map(t => finite(t.realizedPnl)).filter((v): v is number => v !== undefined)
  const holds = input.trades.map(t => finite(t.holdTimeSeconds)).filter((v): v is number => v !== undefined)
  const wins = pnl.filter(v => v > 0).length
  const losses = pnl.filter(v => v < 0)
  const grossProfit = pnl.filter(v => v > 0).reduce((a, b) => a + b, 0)
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0))
  const amounts = input.trades.map(t => finite(t.amountUsd)).filter((v): v is number => v !== undefined)
  const total = amounts.reduce((a, b) => a + b, 0)
  const max = amounts.length ? Math.max(...amounts) : undefined
  const fingerprint: string[] = []
  if (input.trades.some(t => t.newPair)) fingerprint.push('new-pair')
  if (input.trades.some(t => t.migrated)) fingerprint.push('migrated-token')
  if (input.trades.some(t => t.narrative)) fingerprint.push('narrative')
  if ((average(holds) ?? 0) < 3600) fingerprint.push('short-hold')
  else if ((average(holds) ?? 0) > 86400) fingerprint.push('swing-hold')
  if ((grossProfit - grossLoss) > 0) fingerprint.push('profitable-sample')
  return {
    walletId: input.walletId,
    chains: [...new Set(input.chains)],
    tokensPerDay: new Set(input.trades.map(t => t.tokenAddress).filter(Boolean)).size / input.windowDays,
    tradesPerDay: input.trades.length / input.windowDays,
    averageHoldTime: average(holds),
    medianHoldTime: median(holds),
    averageRealizedReturn: average(pnl),
    winRate: pnl.length ? wins / pnl.length : undefined,
    // Never emit Infinity: JSON cannot represent it safely and downstream ranking should
    // distinguish "no observed losses" from an unbounded numeric value.
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : undefined,
    maxDrawdown: undefined,
    concentration: total && max ? max / total : undefined,
    narrativeAffinity: input.trades.length ? input.trades.filter(t => t.narrative).length / input.trades.length : undefined,
    newPairAffinity: input.trades.length ? input.trades.filter(t => t.newPair).length / input.trades.length : undefined,
    migratedTokenAffinity: input.trades.length ? input.trades.filter(t => t.migrated).length / input.trades.length : undefined,
    consistencyScore: pnl.length > 1 ? wins / pnl.length : undefined,
    strategyFingerprint: fingerprint,
    evidenceIds: [...new Set(input.evidenceIds)],
    observedAt: input.observedAt,
  }
}
