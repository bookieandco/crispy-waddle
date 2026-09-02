import type { EvidenceEnvelope, MarketObservation } from './contracts'
import { marketObservationToEvent, MemeMarketEventDispatcher, type MemeMarketEvent } from './market-event'

export type DexScreenerPair = {
  chainId?: unknown
  baseToken?: { address?: unknown }
  liquidity?: { usd?: unknown }
  volume?: { h24?: unknown }
  txns?: { h24?: { buys?: unknown; sells?: unknown } }
  priceUsd?: unknown
  pairCreatedAt?: unknown
}

export type DexScreenerResponse = { pairs?: unknown }

function finiteNumber(value: unknown, field: string, optional = true): number | undefined {
  if (value === undefined || value === null || value === '') {
    if (optional) return undefined
    throw new Error(`${field} is required.`)
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be a finite non-negative number.`)
  return n
}

function stringValue(value: unknown, field: string, optional = false): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (optional) return undefined
    throw new Error(`${field} is required.`)
  }
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  return value
}

/** Runtime validation + normalization at the untrusted DexScreener boundary. */
export function normalizeDexScreenerPair(pair: unknown, receivedAt = new Date().toISOString()): EvidenceEnvelope<MarketObservation> {
  if (!pair || typeof pair !== 'object') throw new Error('DexScreener pair must be an object.')
  const p = pair as DexScreenerPair
  const chainId = stringValue(p.chainId, 'chainId')!
  const tokenAddress = stringValue(p.baseToken?.address, 'baseToken.address')!
  const liquidityUsd = finiteNumber(p.liquidity?.usd, 'liquidity.usd')
  const volume24hUsd = finiteNumber(p.volume?.h24, 'volume.h24')
  const buys24h = finiteNumber(p.txns?.h24?.buys, 'txns.h24.buys')
  const sells24h = finiteNumber(p.txns?.h24?.sells, 'txns.h24.sells')
  const priceUsd = finiteNumber(p.priceUsd, 'priceUsd')
  const pairCreatedAtMs = finiteNumber(p.pairCreatedAt, 'pairCreatedAt')
  const observedAt = pairCreatedAtMs === undefined ? receivedAt : new Date(pairCreatedAtMs).toISOString()

  if (Number.isNaN(Date.parse(receivedAt))) throw new Error('receivedAt must be an ISO timestamp.')

  const observationId = [chainId, tokenAddress, observedAt, String(liquidityUsd ?? ''), String(volume24hUsd ?? ''), String(buys24h ?? ''), String(sells24h ?? '')].join(':')

  return {
    observationId,
    source: 'dexscreener',
    observedAt,
    receivedAt,
    chainId,
    subjectId: tokenAddress,
    payload: { liquidityUsd, volume24hUsd, buys24h, sells24h, priceUsd },
    sourceRef: `dexscreener:${chainId}:${tokenAddress}`,
    provenance: { adapter: 'dexscreener-event-ingest', validation: 'runtime' },
  }
}

export type DexScreenerEventSink = { publish(event: MemeMarketEvent): Promise<void> }

/**
 * Converts validated DexScreener pairs into MARKET_OBSERVED events and
 * suppresses duplicate observation IDs within the process lifetime.
 */
export class DexScreenerEventIngestor {
  private readonly seen = new Set<string>()
  constructor(private readonly sink: DexScreenerEventSink = new MemeMarketEventDispatcher()) {}

  async ingest(pair: unknown, receivedAt?: string): Promise<{ status: 'published' | 'duplicate'; event?: MemeMarketEvent }> {
    const evidence = normalizeDexScreenerPair(pair, receivedAt)
    if (this.seen.has(evidence.observationId)) return { status: 'duplicate' }
    const event = marketObservationToEvent(evidence)
    this.seen.add(evidence.observationId)
    await this.sink.publish(event)
    return { status: 'published', event }
  }

  clearSeen(): void { this.seen.clear() }
}
