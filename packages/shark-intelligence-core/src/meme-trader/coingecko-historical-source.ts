import type { TokenLaunch } from './wallet-launch-pipeline'
import type { HistoricalCandle, HistoricalHolderPoint } from './historical-observation-backfill'

export type CoinGeckoHistoricalSourceOptions = { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch }

export class CoinGeckoHistoricalSource {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  constructor(private readonly options: CoinGeckoHistoricalSourceOptions) { this.baseUrl = options.baseUrl ?? 'https://pro-api.coingecko.com/api/v3'; this.fetchImpl = options.fetchImpl ?? fetch }

  private async get(path: string): Promise<any> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: { 'x-cg-pro-api-key': this.options.apiKey, accept: 'application/json' } })
    if (!response.ok) throw new Error(`CoinGecko historical request failed: ${response.status}`)
    return response.json()
  }

  async candles(launch: TokenLaunch, timeframe: 'hour' | 'day' = 'hour', aggregate = 1, beforeTimestamp?: number): Promise<HistoricalCandle[]> {
    const query = new URLSearchParams({ aggregate: String(aggregate), limit: '1000', currency: 'usd', include_empty_intervals: 'false' })
    if (beforeTimestamp) query.set('before_timestamp', String(beforeTimestamp))
    const json = await this.get(`/onchain/networks/${encodeURIComponent(launch.chainId)}/tokens/${encodeURIComponent(launch.tokenAddress)}/ohlcv/${timeframe}?${query}`)
    const rows = json?.data?.attributes?.ohlcv_list
    if (!Array.isArray(rows)) return []
    return rows.filter((r: unknown) => Array.isArray(r) && r.length >= 6).map((r: any[]) => ({
      observedAt: new Date(Number(r[0]) * 1000).toISOString(), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volumeUsd: Number(r[5]),
      source: 'coingecko-onchain-ohlcv', evidenceId: `coingecko:ohlcv:${launch.tokenAddress}:${r[0]}`,
    })).filter((r: HistoricalCandle) => [r.open, r.high, r.low, r.close].every(Number.isFinite))
  }

  async holderHistory(launch: TokenLaunch): Promise<HistoricalHolderPoint[]> {
    const json = await this.get(`/onchain/networks/${encodeURIComponent(launch.chainId)}/tokens/${encodeURIComponent(launch.tokenAddress)}/holders_chart`)
    const rows = json?.data?.attributes?.holders_chart ?? json?.data?.attributes?.holders
    if (!Array.isArray(rows)) return []
    return rows.map((r: any) => {
      const timestamp = Array.isArray(r) ? r[0] : r.timestamp
      const count = Array.isArray(r) ? r[1] : r.holders
      return { observedAt: new Date(Number(timestamp) * 1000).toISOString(), holderCount: Number(count), source: 'coingecko-onchain-holders', evidenceId: `coingecko:holders:${launch.tokenAddress}:${timestamp}` }
    }).filter((r: HistoricalHolderPoint) => Number.isFinite(r.holderCount) && !Number.isNaN(Date.parse(r.observedAt)))
  }
}
