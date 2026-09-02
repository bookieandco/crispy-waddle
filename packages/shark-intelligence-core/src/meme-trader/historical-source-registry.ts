import type { TokenLaunch } from './wallet-launch-pipeline'
import type { ActorMovement, HistoricalCandle, HistoricalHolderPoint } from './historical-observation-backfill'
import type { LiquidityHistory } from './liquidity-history'

export type HistoricalSourceCapability = 'market' | 'holders' | 'actors' | 'liquidity'
export type HistoricalSourceStatus = 'complete' | 'partial' | 'missing' | 'error'

export type HistoricalSourceResult<T> = {
  source: string
  status: HistoricalSourceStatus
  data: T
  observedFrom?: string
  observedTo?: string
  evidenceIds: string[]
  error?: string
}

export type HistoricalProviderBundle = {
  market?: HistoricalSourceResult<HistoricalCandle[]>
  holders?: HistoricalSourceResult<HistoricalHolderPoint[]>
  actors?: HistoricalSourceResult<ActorMovement[]>
  liquidity?: HistoricalSourceResult<LiquidityHistory>
}

export interface HistoricalObservationSource {
  readonly name: string
  readonly capabilities: readonly HistoricalSourceCapability[]
  collect(launch: TokenLaunch, window: { from: string; to?: string }): Promise<HistoricalProviderBundle>
}

export type HistoricalSourceQuality = {
  source: string
  capability: HistoricalSourceCapability
  coverage: number
  completeness: number
  freshness: number
  provenance: number
  reliability: number
}

export type HistoricalProviderRegistryOptions = {
  sources: HistoricalObservationSource[]
  quality?: HistoricalSourceQuality[]
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }

export class HistoricalObservationSourceRegistry {
  private readonly sources: HistoricalObservationSource[]
  private readonly quality: Map<string, HistoricalSourceQuality>

  constructor(options: HistoricalProviderRegistryOptions) {
    this.sources = [...options.sources]
    this.quality = new Map((options.quality ?? []).map(q => [`${q.source}:${q.capability}`, q]))
  }

  list(): readonly HistoricalObservationSource[] { return this.sources }

  rank(capability: HistoricalSourceCapability): HistoricalObservationSource[] {
    return [...this.sources]
      .filter(source => source.capabilities.includes(capability))
      .sort((a, b) => this.score(b.name, capability) - this.score(a.name, capability))
  }

  score(source: string, capability: HistoricalSourceCapability): number {
    const q = this.quality.get(`${source}:${capability}`)
    if (!q) return 0.5
    return clamp01((q.coverage + q.completeness + q.freshness + q.provenance + q.reliability) / 5)
  }

  async collect(launch: TokenLaunch, window: { from: string; to?: string }): Promise<HistoricalProviderBundle> {
    const ranked = [...this.sources].sort((a, b) => {
      const bScore = Math.max(...b.capabilities.map(c => this.score(b.name, c)))
      const aScore = Math.max(...a.capabilities.map(c => this.score(a.name, c)))
      return bScore - aScore
    })
    const merged: HistoricalProviderBundle = {}
    for (const source of ranked) {
      let bundle: HistoricalProviderBundle
      try {
        bundle = await source.collect(launch, window)
      } catch (error) {
        continue
      }
      if (bundle.market && !merged.market) merged.market = bundle.market
      if (bundle.holders && !merged.holders) merged.holders = bundle.holders
      if (bundle.actors && !merged.actors) merged.actors = bundle.actors
      if (bundle.liquidity && !merged.liquidity) merged.liquidity = bundle.liquidity
    }
    return merged
  }
}

export function assessHistoricalCompleteness(bundle: HistoricalProviderBundle): Record<HistoricalSourceCapability, HistoricalSourceStatus> {
  return {
    market: bundle.market?.status ?? 'missing',
    holders: bundle.holders?.status ?? 'missing',
    actors: bundle.actors?.status ?? 'missing',
    liquidity: bundle.liquidity?.status ?? 'missing',
  }
}
