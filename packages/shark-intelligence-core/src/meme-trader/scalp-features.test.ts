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
  it('contains nine candidate strategies and no validated profitability claim', () => {
    expect(IMPORTED_SCALP_STRATEGIES).toHaveLength(9)
    expect(IMPORTED_SCALP_STRATEGIES.every(strategy => strategy.status === 'CANDIDATE')).toBe(true)
    expect(IMPORTED_SCALP_STRATEGIES.every(strategy => strategy.source === 'IMPORTED')).toBe(true)
  })

  it('resolves known transcript strategies', () => {
    expect(getScalpStrategy('NEW_PAIR_POST_BUNDLE_DIP').strategyId).toBe('NEW_PAIR_POST_BUNDLE_DIP')
    expect(getScalpStrategy('EARLY_GAINER_TREND_CONFIRMATION').status).toBe('CANDIDATE')
    expect(getScalpStrategy('PUMPFUN_SOCIAL_FLOW_CONFIRMATION').status).toBe('CANDIDATE')
    expect(getScalpStrategy('DEV_HISTORY_CATALYST_CONTINUATION').status).toBe('CANDIDATE')
    expect(getScalpStrategy('META_DERIVATIVE_ROTATION').status).toBe('CANDIDATE')
  })

  it('keeps imported signal claims separate from execution authority', () => {
    const social = getScalpStrategy('PUMPFUN_SOCIAL_FLOW_CONFIRMATION')
    expect(social.entryRules.some(rule => rule.field === 'followedTraderIndependentFlowScore')).toBe(true)
    expect(social.invalidationRules.some(rule => rule.field === 'copyClusterConcentration')).toBe(true)

    const gainers = getScalpStrategy('EARLY_GAINER_TREND_CONFIRMATION')
    expect(gainers.entryRules.some(rule => rule.field === 'higherTimeframeTrendQuality')).toBe(true)
    expect(gainers.invalidationRules.some(rule => rule.field === 'exitLiquidityScore')).toBe(true)

    const devCatalyst = getScalpStrategy('DEV_HISTORY_CATALYST_CONTINUATION')
    expect(devCatalyst.entryRules.some(rule => rule.field === 'developerTrackRecordScore')).toBe(true)
    expect(devCatalyst.invalidationRules.some(rule => rule.field === 'volumeDecayScore')).toBe(true)

    const derivative = getScalpStrategy('META_DERIVATIVE_ROTATION')
    expect(derivative.entryRules.some(rule => rule.field === 'primaryNarrativeFlowScore')).toBe(true)
    expect(derivative.invalidationRules.some(rule => rule.field === 'sniperInventoryRisk')).toBe(true)
  })
})
