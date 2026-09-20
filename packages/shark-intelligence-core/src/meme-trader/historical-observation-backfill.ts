import type { TokenLaunch } from './wallet-launch-pipeline'
import type { LiquidityHistory } from './liquidity-history'

export type HistoricalCandle = { observedAt: string; open: number; high: number; low: number; close: number; volumeUsd?: number; source: string; evidenceId: string }
export type HistoricalHolderPoint = { observedAt: string; holderCount: number; source: string; evidenceId: string }
export type ActorMovement = { observedAt: string; actorId: string; direction: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'LIQUIDITY_ADD' | 'LIQUIDITY_REMOVE'; amountUsd?: number; tokenAmount?: number; source: string; evidenceId: string }
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

function stableFingerprint(value: string): string {
  let a = 0x811c9dc5
  let b = 0x9e3779b9
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    a ^= code
    a = Math.imul(a, 0x01000193) >>> 0
    b ^= code + i
    b = Math.imul(b, 0x85ebca6b) >>> 0
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}

export function buildHistoricalObservation(input: { launch: TokenLaunch; candles: HistoricalCandle[]; holders?: HistoricalHolderPoint[]; movements?: ActorMovement[]; liquidityHistory?: LiquidityHistory; now: string }): HistoricalObservation {
  const candles = [...input.candles].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  const first = candles[0]; const last = candles.at(-1)
  const evidence = new Set<string>(input.launch.evidenceIds)
  candles.forEach(c => evidence.add(c.evidenceId)); input.holders?.forEach(h => evidence.add(h.evidenceId)); input.movements?.forEach(m => evidence.add(m.evidenceId)); input.liquidityHistory?.evidenceIds.forEach(id => evidence.add(id))
  const peak = candles.length ? Math.max(...candles.map(c => c.high)) : undefined
  const peakReturnPct = first && peak !== undefined ? pct(peak, first.open) : undefined
  const priceReturnFromLaunchPct = first && last ? pct(last.close, first.open) : undefined
  const maxDrawdownPct = candles.length && peak && peak > 0 ? Math.max(...candles.map(c => (peak - c.low) / peak)) : undefined
  const holders = [...(input.holders ?? [])].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  const firstHolder = holders[0]?.holderCount; const lastHolder = holders.at(-1)?.holderCount
  const holderCountChangePct = firstHolder && firstHolder > 0 && lastHolder !== undefined ? ((lastHolder - firstHolder) / firstHolder) * 100 : undefined
  const holderExitPct = holders.length >= 2 && firstHolder && firstHolder > 0 && lastHolder !== undefined ? clamp01((firstHolder - lastHolder) / firstHolder) : undefined
  const sales = input.movements?.filter(m => m.actorId === input.launch.deployerWalletId && (m.direction === 'SELL' || m.direction === 'TRANSFER_OUT')) ?? []
  const buys = input.movements?.filter(m => m.actorId === input.launch.deployerWalletId && (m.direction === 'BUY' || m.direction === 'TRANSFER_IN')) ?? []
  const soldAmount = sales.reduce((sum, m) => sum + (finite(m.tokenAmount) ? m.tokenAmount! : finite(m.amountUsd) ? m.amountUsd! : 0), 0)
  const boughtAmount = buys.reduce((sum, m) => sum + (finite(m.tokenAmount) ? m.tokenAmount! : finite(m.amountUsd) ? m.amountUsd! : 0), 0)
  const developerSoldPct = soldAmount + boughtAmount > 0 ? clamp01(soldAmount / (soldAmount + boughtAmount)) : undefined
  let holderBehavior: HistoricalObservation['holderBehavior']
  if (holderCountChangePct !== undefined) holderBehavior = (holderExitPct ?? 0) >= 0.5 ? 'PANIC_EXIT' : holderCountChangePct >= 10 ? 'ACCUMULATING' : holderCountChangePct <= -10 ? 'DISTRIBUTING' : 'STABLE'
  const liquidityRemoved = input.liquidityHistory ? input.liquidityHistory.drawdownFromPeak >= 0.5 || input.liquidityHistory.drainRate >= 0.25 : input.movements?.some(m => m.direction === 'LIQUIDITY_REMOVE')
  const observedTimes = [
    ...candles.map(item => item.observedAt),
    ...holders.map(item => item.observedAt),
    ...(input.movements ?? []).map(item => item.observedAt),
    ...(input.liquidityHistory?.snapshots ?? []).map(item => item.observedAt),
  ].filter(value => !Number.isNaN(Date.parse(value)))
  const observedAt = observedTimes.length
    ? observedTimes.reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest)
    : input.now
  const evidenceIds = [...evidence].sort()
  const fingerprint = stableFingerprint(JSON.stringify([
    input.launch.launchId,
    observedAt,
    evidenceIds,
    priceReturnFromLaunchPct ?? null,
    peakReturnPct ?? null,
    maxDrawdownPct ?? null,
    input.liquidityHistory?.currentLiquidityUsd ?? null,
    input.liquidityHistory?.peakLiquidityUsd ?? null,
    input.liquidityHistory?.drawdownFromPeak ?? null,
    holderCountChangePct ?? null,
    holderExitPct ?? null,
    developerSoldPct ?? null,
    liquidityRemoved ?? null,
    holderBehavior ?? null,
  ]))
  return {
    observationId: `historical-observation:${input.launch.launchId}:${fingerprint}`,
    launchId: input.launch.launchId, observedAt,
    priceReturnFromLaunchPct, peakReturnPct, maxDrawdownPct,
    currentLiquidityUsd: input.liquidityHistory?.currentLiquidityUsd,
    peakLiquidityUsd: input.liquidityHistory?.peakLiquidityUsd,
    liquidityDrawdownFromPeak: input.liquidityHistory?.drawdownFromPeak,
    holderCountChangePct, holderExitPct, developerSoldPct,
    liquidityRemoved: liquidityRemoved || undefined, holderBehavior, evidenceIds, source: 'historical-backfill',
  }
}
