import { describe, expect, it } from 'vitest'
import { HistoricalObservationSourceRegistry, assessHistoricalCompleteness, type HistoricalObservationSource } from '../historical-source-registry'

describe('historical source registry', () => {
  const source = (name: string, capability: 'market' | 'holders' | 'actors' | 'liquidity', value: unknown): HistoricalObservationSource => ({
    name,
    capabilities: [capability],
    async collect() { return { [capability]: { source: name, status: 'complete', data: value, evidenceIds: [`${name}:e1`] } } }
  })

  it('ranks sources by quality and preserves capability separation', async () => {
    const registry = new HistoricalObservationSourceRegistry({
      sources: [source('weak', 'market', []), source('strong', 'market', [{ evidenceId: 'e1' }])],
      quality: [
        { source: 'weak', capability: 'market', coverage: .2, completeness: .2, freshness: .2, provenance: .2, reliability: .2 },
        { source: 'strong', capability: 'market', coverage: 1, completeness: 1, freshness: 1, provenance: 1, reliability: 1 },
      ],
    })
    expect(registry.rank('market').map(x => x.name)).toEqual(['strong', 'weak'])
    const bundle = await registry.collect({ launchId: 'l', chainId: 'solana-mainnet', tokenAddress: 'm', deployerWalletId: 'd', launchedAt: '2026-01-01T00:00:00Z', outcome: 'UNKNOWN', evidenceIds: [] }, { from: '2026-01-01T00:00:00Z' })
    expect(bundle.market?.source).toBe('strong')
    expect(assessHistoricalCompleteness(bundle)).toEqual({ market: 'complete', holders: 'missing', actors: 'missing', liquidity: 'missing' })
  })

  it('does not turn absent providers into positive evidence', () => {
    expect(assessHistoricalCompleteness({})).toEqual({ market: 'missing', holders: 'missing', actors: 'missing', liquidity: 'missing' })
  })
})
