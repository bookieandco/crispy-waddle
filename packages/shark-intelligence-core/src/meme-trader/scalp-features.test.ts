import { describe, expect, it } from 'vitest'
import { deriveScalpFeatures } from './scalp-features'
import { getScalpStrategy, IMPORTED_SCALP_STRATEGIES } from './scalp-strategy-registry'

describe('meme trader scalp features', () => {
  it('uses relative launch baseline instead of fixed market-cap dollars', () => {
    const features = deriveScalpFeatures({
      launchMarketCapUsd: 2400,
      currentMarketCapUsd: 6000,
      localHighMarketCapUsd: 12000,
      floorMarketCapUsd: 3000,
    })
    expect(features.marketCapVsLaunchBaseline).toBe(2.5)
    expect(features.drawdownFromLocalHigh).toBeCloseTo(0.5)
    expect(features.floorRecoveryFraction).toBeCloseTo(0.3333, 3)
  })

  it('does not invent a flow entropy value without enough candle observations', () => {
    const features = deriveScalpFeatures({ candleBodySizes: [1] })
    expect(features.candleSizeVariability).toBeUndefined()
    expect(features.flowEntropyProxy).toBeUndefined()
  })

  it('bounds stability and liquidity features', () => {
    const features = deriveScalpFeatures({
      floorTouches: 10,
      floorRejections: 12,
      consolidationRangeFraction: 0.1,
      consolidationDurationMinutes: 120,
      liquidityUsd: 10000,
      liquidityDepthUsd: 10000,
    })
    expect(features.floorStabilityScore).toBe(1)
    expect(features.consolidationStabilityScore).toBeLessThanOrEqual(1)
    expect(features.exitLiquidityScore).toBeLessThanOrEqual(1)
  })
})

describe('imported scalp strategy registry', () => {
  it('contains five candidate strategies and no validated profitability claim', () => {
    expect(IMPORTED_SCALP_STRATEGIES).toHaveLength(5)
    expect(IMPORTED_SCALP_STRATEGIES.every(strategy => strategy.status === 'CANDIDATE')).toBe(true)
    expect(IMPORTED_SCALP_STRATEGIES.every(strategy => strategy.source === 'IMPORTED')).toBe(true)
  })

  it('resolves a known strategy', () => {
    expect(getScalpStrategy('NEW_PAIR_POST_BUNDLE_DIP').strategyId).toBe('NEW_PAIR_POST_BUNDLE_DIP')
  })
})
