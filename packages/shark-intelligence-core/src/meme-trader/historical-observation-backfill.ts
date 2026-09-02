import type { TokenLaunch } from './wallet-launch-pipeline'

export type HistoricalCandle = { observedAt: string; open: number; high: number; low: number; close: number; volumeUsd?: number; source: string; evidenceId: string }
export type HistoricalHolderPoint = { observedAt: string; holderCount: number; source: string; evidenceId: string }
export type ActorMovement = { observedAt: string; actorId: string; direction: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'LIQUIDITY_ADD' | 'LIQUIDITY_REMOVE'; amountUsd?: number; source: string; evidenceId: string }
export type HistoricalObservation = {
  observationId: string; launchId: string; observedAt: string
  priceReturnFromLaunchPct?: number; peakReturnPct?: number; maxDrawdownPct?: number
  currentLiquidityUsd?: number; peakLiquidityUsd?: number; liquidityDrawdownFromPeak?: number
  holderCountChangePct?: number; holderExitPct?: number; developerSoldPct?: number
  liquidityRemoved?: boolean; tradingHalted?: boolean
  holderBehavior?: 'ACCUMULATING' | 'STABLE' | 'DISTRIBUTING' | 'PANIC_EXIT'
  evidenceIds: string[]; source: string
}

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function pct(current: number, initial: number): number | undefined { return finite(current) && finite(initial) && initial !== 0 ? ((current - initial) / initial) * 100 : undefined }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }

export function buildHistoricalObservation(input: { launch: TokenLaunch; candles: HistoricalCandle[]; holders?: HistoricalHolderPoint[]; movements?: ActorMovement[]; now: string }): HistoricalObservation {
  const candles = [...input.candles].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  const first = candles[0]
  const last = candles.at(-1)
  const evidence = new Set<string>(input.launch.evidenceIds)
  candles.forEach(c => evidence.add(c.evidenceId)); input.holders?.forEach(h => evidence.add(h.evidenceId)); input.movements?.forEach(m => evidence.add(m.evidenceId))
  const peak = candles.length ? Math.max(...candles.map(c => c.high)) : undefined
  const peakReturnPct = first && peak !== undefined ? pct(peak, first.open) : undefined
  const priceReturnFromLaunchPct = first && last ? pct(last.close, first.open) : undefined
  const maxDrawdownPct = candles.length && peak && peak > 0 ? Math.max(...candles.map(c => ((peak - c.low) / peak) * 100)) : undefined
  const holders = [...(input.holders ?? [])].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  const firstHolder = holders[0]?.holderCount; const lastHolder = holders.at(-1)?.holderCount
  const holderCountChangePct = firstHolder && firstHolder > 0 && lastHolder !== undefined ? ((lastHolder - firstHolder) / firstHolder) * 100 : undefined
  const holderExitPct = holders.length >= 2 && firstHolder && firstHolder > 0 && lastHolder !== undefined ? clamp01((firstHolder - lastHolder) / firstHolder) : undefined
  const sales = input.movements?.filter(m => m.actorId === input.launch.deployerWalletId && (m.direction === 'SELL' || m.direction === 'TRANSFER_OUT')) ?? []
  const buys = input.movements?.filter(m => m.actorId === input.launch.deployerWalletId && (m.direction === 'BUY' || m.direction === 'TRANSFER_IN')) ?? []
  const soldUsd = sales.reduce((sum, m) => sum + (m.amountUsd ?? 0), 0); const boughtUsd = buys.reduce((sum, m) => sum + (m.amountUsd ?? 0), 0)
  const developerSoldPct = soldUsd + boughtUsd > 0 ? clamp01(soldUsd / (soldUsd + boughtUsd)) : undefined
  let holderBehavior: HistoricalObservation['holderBehavior']
  if (holderCountChangePct !== undefined) holderBehavior = (holderExitPct ?? 0) >= 0.5 ? 'PANIC_EXIT' : holderCountChangePct >= 10 ? 'ACCUMULATING' : holderCountChangePct <= -10 ? 'DISTRIBUTING' : 'STABLE'
  const liquidityRemoved = input.movements?.some(m => m.direction === 'LIQUIDITY_REMOVE')
  return {
    observationId: `historical-observation:${input.launch.launchId}:${last?.observedAt ?? input.now}`,
    launchId: input.launch.launchId, observedAt: last?.observedAt ?? input.now,
    priceReturnFromLaunchPct, peakReturnPct, maxDrawdownPct, holderCountChangePct, holderExitPct, developerSoldPct,
    liquidityRemoved: liquidityRemoved || undefined, holderBehavior, evidenceIds: [...evidence], source: 'historical-backfill',
  }
}
