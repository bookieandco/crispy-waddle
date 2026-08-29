import type { SharkLearningSnapshot, SharkOpportunityDecision, SharkStreetSignal } from './index.js'

export type SharkFeatureVector = {
  liquidity: number
  holderDistribution: number
  contractSafety: number
  sellability: number
  marketStructure: number
  walletBehavior: number
  socialQuality: number
  migrationQuality: number
  sourceQuality: number
  novelty: number
  repeatability: number
}

export type SharkScore = {
  score: number
  confidence: number
  downsideRisk: number
  vector: SharkFeatureVector
  reasons: string[]
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))

const signalMap: Record<SharkStreetSignal['name'], keyof SharkFeatureVector> = {
  liquidity_flight: 'liquidity',
  insider_accumulation: 'walletBehavior',
  insider_distribution: 'walletBehavior',
  holder_concentration: 'holderDistribution',
  volume_anomaly: 'marketStructure',
  social_hype_without_depth: 'socialQuality',
  developer_behavior: 'contractSafety',
  migration_behavior: 'migrationQuality',
  wash_activity: 'marketStructure',
  failed_sellability: 'sellability',
}

export function buildSharkFeatureVector(decision: SharkOpportunityDecision): SharkFeatureVector {
  const vector: SharkFeatureVector = {
    liquidity: 1,
    holderDistribution: 1,
    contractSafety: 1,
    sellability: 1,
    marketStructure: 1,
    walletBehavior: 0.5,
    socialQuality: 0.5,
    migrationQuality: 0.5,
    sourceQuality: clamp(decision.sourceQuality),
    novelty: clamp(decision.novelty),
    repeatability: clamp(decision.repeatability),
  }

  for (const signal of decision.streetSignals) {
    const key = signalMap[signal.name]
    const strength = clamp(signal.strength)
    if (signal.direction === 'negative') vector[key] = clamp(vector[key] - strength * 0.5)
    if (signal.direction === 'positive') vector[key] = clamp(vector[key] + strength * 0.25)
  }

  for (const risk of decision.risks) {
    if (risk === 'liquidity') vector.liquidity *= 0.4
    if (risk === 'holder_concentration') vector.holderDistribution *= 0.5
    if (risk === 'contract_control') vector.contractSafety *= 0.25
    if (risk === 'sellability') vector.sellability *= 0.2
    if (risk === 'market_structure') vector.marketStructure *= 0.6
    if (risk === 'social_manipulation') vector.socialQuality *= 0.5
    if (risk === 'wallet_behavior') vector.walletBehavior *= 0.6
  }

  return vector
}

export function scoreSharkOpportunity(
  decision: SharkOpportunityDecision,
  learning?: SharkLearningSnapshot,
): SharkScore {
  const vector = buildSharkFeatureVector(decision)
  const weights: Array<[keyof SharkFeatureVector, number]> = [
    ['liquidity', 0.15],
    ['holderDistribution', 0.10],
    ['contractSafety', 0.15],
    ['sellability', 0.15],
    ['marketStructure', 0.10],
    ['walletBehavior', 0.10],
    ['socialQuality', 0.05],
    ['migrationQuality', 0.05],
    ['sourceQuality', 0.05],
    ['novelty', 0.025],
    ['repeatability', 0.025],
  ]

  const base = weights.reduce((sum, [key, weight]) => sum + vector[key] * weight, 0)
  const adjustment = learning ? learningAdjustmentSafe(learning) : 0
  const score = clamp(base + adjustment)
  const downsideRisk = clamp(1 - (vector.liquidity + vector.contractSafety + vector.sellability) / 3)
  const reasons: string[] = []

  if (vector.liquidity < 0.5) reasons.push('liquidity weakness')
  if (vector.sellability < 0.5) reasons.push('sellability weakness')
  if (vector.contractSafety < 0.5) reasons.push('contract-control risk')
  if (vector.walletBehavior > 0.7) reasons.push('strong wallet behavior')
  if (vector.migrationQuality > 0.7) reasons.push('positive migration signal')
  if (vector.socialQuality < 0.4) reasons.push('social hype lacks depth')

  return {
    score,
    confidence: clamp(decision.confidence * (0.5 + vector.sourceQuality / 2)),
    downsideRisk,
    vector,
    reasons,
  }
}

function learningAdjustmentSafe(snapshot: SharkLearningSnapshot): number {
  const stats = snapshot.features ?? {}
  const values = Object.values(stats)
  if (values.length === 0) return 0
  const weighted = values.reduce((sum, stat) => sum + (stat.meanReturn ?? 0), 0) / values.length
  return Math.max(-0.1, Math.min(0.1, weighted * 0.2))
}
