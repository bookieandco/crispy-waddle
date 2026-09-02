export type ScalpFeatureInput = {
  launchMarketCapUsd?: number
  currentMarketCapUsd?: number
  localHighMarketCapUsd?: number
  floorMarketCapUsd?: number
  pairAgeHours?: number
  migrationAgeHours?: number
  buyVolumeUsd?: number
  sellVolumeUsd?: number
  uniqueBuyers?: number
  uniqueSellers?: number
  candleBodySizes?: number[]
  devNetFlowUsd?: number
  trackedSellerExhaustionScore?: number
  floorTouches?: number
  floorRejections?: number
  consolidationRangeFraction?: number
  consolidationDurationMinutes?: number
  liquidityUsd?: number
  liquidityDepthUsd?: number
  socialConfirmationScore?: number
  walletConfirmationScore?: number
}

export type ScalpFeatures = {
  marketCapVsLaunchBaseline?: number
  drawdownFromLocalHigh?: number
  floorRecoveryFraction?: number
  buySellImbalance?: number
  realBuyerConfirmation?: number
  candleSizeVariability?: number
  flowEntropyProxy?: number
  floorStabilityScore?: number
  consolidationStabilityScore?: number
  exitLiquidityScore?: number
  devNetFlowAfterPeak?: number
  trackedSellerExhaustionScore?: number
  pairAgeHours?: number
  migrationAgeHours?: number
  socialConfirmationScore?: number
  walletConfirmationScore?: number
}

const finite = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

function ratio(a?: number, b?: number): number | undefined {
  if (a === undefined || b === undefined || b <= 0) return undefined
  return a / b
}

function coefficientOfVariation(values: number[]): number | undefined {
  const finiteValues = values.map(finite).filter((v): v is number => v !== undefined && v >= 0)
  if (finiteValues.length < 2) return undefined
  const mean = finiteValues.reduce((a, b) => a + b, 0) / finiteValues.length
  if (mean <= 0) return 0
  const variance = finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finiteValues.length
  return Math.sqrt(variance) / mean
}

/**
 * Converts raw market/flow observations into relative features used by candidate
 * scalp strategies. It intentionally does not emit a buy/sell decision.
 */
export function deriveScalpFeatures(input: ScalpFeatureInput): ScalpFeatures {
  const launch = finite(input.launchMarketCapUsd)
  const current = finite(input.currentMarketCapUsd)
  const high = finite(input.localHighMarketCapUsd)
  const floor = finite(input.floorMarketCapUsd)
  const buys = finite(input.buyVolumeUsd)
  const sells = finite(input.sellVolumeUsd)
  const buyers = finite(input.uniqueBuyers)
  const sellers = finite(input.uniqueSellers)

  const buySellImbalance = buys !== undefined && sells !== undefined && buys + sells > 0
    ? (buys - sells) / (buys + sells)
    : undefined

  const realBuyerConfirmation = buyers !== undefined && sellers !== undefined && buyers + sellers > 0
    ? clamp01(buyers / (buyers + sellers))
    : undefined

  const cv = coefficientOfVariation(input.candleBodySizes ?? [])
  const candleSizeVariability = cv === undefined ? undefined : clamp01(cv / 2)

  const floorTouches = finite(input.floorTouches)
  const floorRejections = finite(input.floorRejections)
  const floorStabilityScore = floorTouches !== undefined && floorRejections !== undefined && floorTouches > 0
    ? clamp01(floorRejections / floorTouches)
    : undefined

  const range = finite(input.consolidationRangeFraction)
  const duration = finite(input.consolidationDurationMinutes)
  const consolidationStabilityScore = range !== undefined
    ? clamp01((1 - range) * (duration === undefined ? 1 : Math.min(1, duration / 30)))
    : undefined

  const liquidity = finite(input.liquidityUsd)
  const depth = finite(input.liquidityDepthUsd)
  const exitLiquidityScore = liquidity !== undefined
    ? clamp01(((depth ?? liquidity) / Math.max(liquidity, 1)) / 2)
    : undefined

  return {
    marketCapVsLaunchBaseline: ratio(current, launch),
    drawdownFromLocalHigh: current !== undefined && high !== undefined && high > 0 ? clamp01(1 - current / high) : undefined,
    floorRecoveryFraction: current !== undefined && floor !== undefined && high !== undefined && high > floor
      ? clamp01((current - floor) / (high - floor))
      : undefined,
    buySellImbalance,
    realBuyerConfirmation,
    candleSizeVariability,
    // This is deliberately named a proxy: true flow entropy needs event-level data.
    flowEntropyProxy: candleSizeVariability === undefined ? undefined : clamp01(candleSizeVariability * 0.7 + (realBuyerConfirmation ?? 0.5) * 0.3),
    floorStabilityScore,
    consolidationStabilityScore,
    exitLiquidityScore,
    devNetFlowAfterPeak: input.devNetFlowUsd !== undefined && liquidity !== undefined && liquidity > 0
      ? input.devNetFlowUsd / liquidity
      : finite(input.devNetFlowUsd),
    trackedSellerExhaustionScore: finite(input.trackedSellerExhaustionScore),
    pairAgeHours: finite(input.pairAgeHours),
    migrationAgeHours: finite(input.migrationAgeHours),
    socialConfirmationScore: finite(input.socialConfirmationScore),
    walletConfirmationScore: finite(input.walletConfirmationScore),
  }
}
