import type { TokenLaunch } from './wallet-launch-pipeline'
import type { HistoricalCandle, HistoricalHolderPoint } from './historical-observation-backfill'

export type CoinGeckoHistoricalSourceOptions = { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch; maxPages?: number }

const coinGeckoNetworkId = (chainId: string): string => {
  if (chainId === 'solana-mainnet') return 'solana'
  if (chainId === 'solana-devnet') throw new Error('CoinGecko historical source does not support solana-devnet')
  return chainId
}

export class CoinGeckoHistoricalSource {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly maxPages: number
  constructor(private readonly options: CoinGeckoHistoricalSourceOptions) {
    this.baseUrl = options.baseUrl ?? 'https://pro-api.coingecko.com/api/v3'
    this.fetchImpl = options.fetchImpl ?? fetch
    this.maxPages = options.maxPages ?? 20
  }

  private async get(path: string): Promise<any> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: { 'x-cg-pro-api-key': this.options.apiKey, accept: 'application/json' } })
    if (!response.ok) throw new Error(`CoinGecko historical request failed: ${response.status}`)
    return response.json()
  }

  async candles(launch: TokenLaunch, timeframe: 'hour' | 'day' = 'hour', aggregate = 1, beforeTimestamp?: number): Promise<HistoricalCandle[]> {
    const launchSeconds = Math.floor(Date.parse(launch.launchedAt) / 1000)
    if (!Number.isFinite(launchSeconds)) throw new Error('CoinGecko historical source requires a valid launch timestamp.')

    const collected = new Map<string, HistoricalCandle>()
    let cursor = beforeTimestamp
    let reachedLaunch = false

    for (let page = 0; page < (beforeTimestamp ? 1 : this.maxPages); page += 1) {
      const query = new URLSearchParams({ aggregate: String(aggregate), limit: '1000', currency: 'usd', include_empty_intervals: 'false' })
      if (cursor) query.set('before_timestamp', String(cursor))
      const json = await this.get(`/onchain/networks/${encodeURIComponent(coinGeckoNetworkId(launch.chainId))}/tokens/${encodeURIComponent(launch.tokenAddress)}/ohlcv/${timeframe}?${query}`)
      const rows = json?.data?.attributes?.ohlcv_list
      if (!Array.isArray(rows) || !rows.length) { reachedLaunch = true; break }

      let earliest = Number.POSITIVE_INFINITY
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 6) continue
        const seconds = Number(row[0])
        earliest = Math.min(earliest, seconds)
        const candle: HistoricalCandle = {
          observedAt: new Date(seconds * 1000).toISOString(),
          open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volumeUsd: Number(row[5]),
          source: 'coingecko-token-ohlcv-most-liquid-pool',
          evidenceId: `coingecko:ohlcv:${launch.tokenAddress}:${row[0]}`,
        }
        if (Number.isFinite(seconds) && !Number.isNaN(Date.parse(candle.observedAt)) && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) {
          collected.set(candle.evidenceId, candle)
        }
      }

      if (!Number.isFinite(earliest) || earliest <= launchSeconds) { reachedLaunch = true; break }
      const nextCursor = Math.floor(earliest) - 1
      if (cursor !== undefined && nextCursor >= cursor) throw new Error('CoinGecko OHLCV pagination did not advance.')
      cursor = nextCursor
    }

    if (!beforeTimestamp && collected.size && !reachedLaunch) {
      throw new Error('CoinGecko OHLCV history exceeded configured pagination bound.')
    }

    return [...collected.values()]
      .filter(candle => Date.parse(candle.observedAt) >= Date.parse(launch.launchedAt))
      .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  }

  async holderHistory(launch: TokenLaunch): Promise<HistoricalHolderPoint[]> {
    const json = await this.get(`/onchain/networks/${encodeURIComponent(coinGeckoNetworkId(launch.chainId))}/tokens/${encodeURIComponent(launch.tokenAddress)}/holders_chart`)
    const rows = json?.data?.attributes?.holders_chart ?? json?.data?.attributes?.holders
    if (!Array.isArray(rows)) return []
    return rows.map((r: any) => {
      const timestamp = Array.isArray(r) ? r[0] : r.timestamp
      const count = Array.isArray(r) ? r[1] : r.holders
      return { observedAt: new Date(Number(timestamp) * 1000).toISOString(), holderCount: Number(count), source: 'coingecko-onchain-holders', evidenceId: `coingecko:holders:${launch.tokenAddress}:${timestamp}` }
    }).filter((r: HistoricalHolderPoint) => Number.isFinite(r.holderCount) && !Number.isNaN(Date.parse(r.observedAt)))
  }
}
