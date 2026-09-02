import { deriveLiquidityHistory, type LiquidityHistory, type LiquiditySnapshot } from './liquidity-history'
import type { PoolHistory } from './solana-pool-history'

export type PoolLiquidityEvent = { observedAt: string; poolAddress: string; kind: 'SNAPSHOT' | 'LIQUIDITY_ADD' | 'LIQUIDITY_REMOVE'; liquidityUsd: number; source: string; evidenceId: string }
export interface PoolLiquidityDecoder { decode(history: PoolHistory): PoolLiquidityEvent[] }
export type ReconstructedPoolLiquidity = { poolAddress: string; snapshots: LiquiditySnapshot[]; history: LiquidityHistory; eventCount: number; evidenceIds: string[]; decoderSource: string }

/** Converts DEX-specific decoded reserve events into canonical LiquidityHistory. */
export function reconstructPoolLiquidity(input: { history: PoolHistory; decoder: PoolLiquidityDecoder }): ReconstructedPoolLiquidity {
  const events = input.decoder.decode(input.history).filter(e => e.poolAddress === input.history.pool.poolAddress)
  for (const e of events) {
    if (!Number.isFinite(e.liquidityUsd) || e.liquidityUsd < 0) throw new Error('Decoded pool liquidity must be finite and non-negative.')
    if (!e.evidenceId || !e.observedAt) throw new Error('Decoded liquidity events require timestamp and evidence.')
  }
  if (!events.length) throw new Error('No decoded liquidity events are available for this pool.')
  const snapshots = events.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)).map(e => ({ observedAt: e.observedAt, liquidityUsd: e.liquidityUsd, source: e.source, evidenceId: e.evidenceId }))
  return { poolAddress: input.history.pool.poolAddress, snapshots, history: deriveLiquidityHistory(snapshots), eventCount: events.length, evidenceIds: [...new Set([...input.history.evidenceIds, ...events.map(e => e.evidenceId)])], decoderSource: events[0].source }
}

export class UnsupportedPoolLiquidityDecoder implements PoolLiquidityDecoder {
  constructor(private readonly reason: string) {}
  decode(_history: PoolHistory): PoolLiquidityEvent[] { throw new Error(`Pool liquidity decoder unavailable: ${this.reason}`) }
}
