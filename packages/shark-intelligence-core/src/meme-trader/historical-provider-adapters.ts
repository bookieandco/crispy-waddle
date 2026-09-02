import { CoinGeckoHistoricalSource } from './coingecko-historical-source'
import { HeliusHistoricalSource } from './helius-historical-source'
import type { HistoricalObservationSource, HistoricalProviderBundle, HistoricalSourceCapability } from './historical-source-registry'
import type { TokenLaunch } from './wallet-launch-pipeline'

function statusFor<T>(source: string, data: T[], evidenceIds: string[]) {
  return { source, status: data.length ? 'complete' as const : 'missing' as const, data, evidenceIds }
}

export class CoinGeckoHistoricalProviderAdapter implements HistoricalObservationSource {
  readonly name = 'coingecko-onchain'
  readonly capabilities: readonly HistoricalSourceCapability[] = ['market', 'holders']
  constructor(private readonly source: CoinGeckoHistoricalSource) {}

  async collect(launch: TokenLaunch, _window: { from: string; to?: string }): Promise<HistoricalProviderBundle> {
    const [market, holders] = await Promise.allSettled([this.source.candles(launch), this.source.holderHistory(launch)])
    const marketData = market.status === 'fulfilled' ? market.value : []
    const holderData = holders.status === 'fulfilled' ? holders.value : []
    return {
      market: statusFor(this.name, marketData, marketData.map(x => x.evidenceId)),
      holders: statusFor(this.name, holderData, holderData.map(x => x.evidenceId)),
    }
  }
}

export class HeliusHistoricalProviderAdapter implements HistoricalObservationSource {
  readonly name = 'helius-onchain'
  readonly capabilities: readonly HistoricalSourceCapability[] = ['actors']
  constructor(private readonly source: HeliusHistoricalSource) {}

  async collect(launch: TokenLaunch, window: { from: string; to?: string }): Promise<HistoricalProviderBundle> {
    const movements = await this.source.deployerTransfers(launch)
    return { actors: statusFor(this.name, movements, movements.map(x => x.evidenceId)) }
  }
}
