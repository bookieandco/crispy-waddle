import type { EvidenceEnvelope, MarketObservation, SocialObservation, WalletObservation, NetworkHealthObservation } from './contracts'

export type TradeStyle = 'new-pair-speculation' | 'narrative' | 'swing-hold' | 'high-conviction' | 'information-edge'
export type StrategyFit = { score: number; matchedSignals: string[]; conflicts: string[] }
export type ThesisInvalidation = { conditions: string[]; severity: 'low' | 'medium' | 'high' }
export type PositionPlan = { maxPositionFraction: number; entryConditions: string[]; profitTakingConditions: string[]; exitConditions: string[] }
export type MarketActivityQuality = { score: number; volumeScore: number; liquidityScore: number; flowScore: number; manipulationPenalty: number; reasons: string[] }
export type SupplyControlRisk = { score: number; deployerRisk: number; concentrationRisk: number; bundledSupplyRisk: number; liquidityControlRisk: number; reasons: string[] }
export type HolderCohortSignal = { score: number; profitableTrackedWallets: number; accumulatingWallets: number; distributingWallets: number; reasons: string[] }
export type AttentionQuality = { score: number; crossSourceConfirmation: number; engagementQuality: number; sourceCredibility: number; manipulationPenalty: number; reasons: string[] }
export type RiskAssessment = { marketIntegrity: number; liquidityRisk: number; supplyControlRisk: number; holderConcentrationRisk: number; walletCohortRisk: number; socialManipulationRisk: number; narrativeFragilityRisk: number; developerRisk: number; contractRisk: number; networkRisk: number; attentionQuality: number; exitLiquidityRisk: number; overallRisk: number; band: 'candidate' | 'watch' | 'high-risk' | 'blocked' }
export type MemeTradeAssessment = { assessmentId: string; assessedAt: string; token: { chainId: string; tokenAddress: string }; tradeType: TradeStyle; marketActivityQuality: MarketActivityQuality; supplyControl: SupplyControlRisk; holderCohort: HolderCohortSignal; attention: AttentionQuality; strategyFit: StrategyFit; riskAssessment: RiskAssessment; thesis: string; invalidation: ThesisInvalidation; positionPlan: PositionPlan; confidence: number; evidenceIds: string[]; assessmentVersion: string }

const clamp = (n: number) => Math.max(0, Math.min(1, n))

export function classifyTradeStyle(input: { pairAgeHours?: number; migrated?: boolean; narrativeStrength?: number; informationEdge?: boolean }): TradeStyle {
  if (input.informationEdge) return 'information-edge'
  if ((input.pairAgeHours ?? Infinity) < 24 && !input.migrated) return 'new-pair-speculation'
  if ((input.narrativeStrength ?? 0) >= 0.7) return 'narrative'
  if (input.migrated) return 'swing-hold'
  return 'high-conviction'
}

export function assessMarketActivity(market: MarketObservation): MarketActivityQuality {
  const liquidityScore = clamp(Math.log10(Math.max(1, market.liquidityUsd ?? 0)) / 6)
  const volumeScore = clamp(Math.log10(Math.max(1, market.volume24hUsd ?? 0)) / 7)
  const buys = Math.max(0, market.buys24h ?? 0), sells = Math.max(0, market.sells24h ?? 0)
  const flowScore = buys + sells ? buys / (buys + sells) : 0
  const manipulationPenalty = clamp(market.anomalyScore ?? 0)
  return { liquidityScore, volumeScore, flowScore, manipulationPenalty, score: clamp(.35 * volumeScore + .25 * liquidityScore + .25 * flowScore + .15 * (1 - manipulationPenalty)), reasons: [] }
}

export function assessSupplyControl(input: { deployerRisk?: number; concentrationRisk?: number; bundledSupplyRisk?: number; liquidityControlRisk?: number }): SupplyControlRisk {
  const deployerRisk = clamp(input.deployerRisk ?? 0), concentrationRisk = clamp(input.concentrationRisk ?? 0), bundledSupplyRisk = clamp(input.bundledSupplyRisk ?? 0), liquidityControlRisk = clamp(input.liquidityControlRisk ?? 0)
  return { deployerRisk, concentrationRisk, bundledSupplyRisk, liquidityControlRisk, score: clamp(.3 * deployerRisk + .3 * concentrationRisk + .2 * bundledSupplyRisk + .2 * liquidityControlRisk), reasons: [] }
}

export function assessAttentionQuality(input: { crossSourceConfirmation?: number; engagementQuality?: number; sourceCredibility?: number; manipulationPenalty?: number }): AttentionQuality {
  const crossSourceConfirmation = clamp(input.crossSourceConfirmation ?? 0), engagementQuality = clamp(input.engagementQuality ?? 0), sourceCredibility = clamp(input.sourceCredibility ?? 0), manipulationPenalty = clamp(input.manipulationPenalty ?? 0)
  return { crossSourceConfirmation, engagementQuality, sourceCredibility, manipulationPenalty, score: clamp(.35 * crossSourceConfirmation + .3 * engagementQuality + .35 * sourceCredibility - .4 * manipulationPenalty), reasons: [] }
}

export function evaluateRisk(input: Omit<RiskAssessment, 'overallRisk' | 'band'>): RiskAssessment {
  const overallRisk = clamp(.15 * input.marketIntegrity + .12 * input.liquidityRisk + .14 * input.supplyControlRisk + .10 * input.holderConcentrationRisk + .08 * input.walletCohortRisk + .10 * input.socialManipulationRisk + .07 * input.narrativeFragilityRisk + .06 * input.developerRisk + .05 * input.contractRisk + .05 * input.networkRisk + .04 * (1 - input.attentionQuality) + .04 * input.exitLiquidityRisk)
  const band = overallRisk >= .8 ? 'blocked' : overallRisk >= .6 ? 'high-risk' : overallRisk >= .4 ? 'watch' : 'candidate'
  return { ...input, overallRisk, band }
}

export function createMemeTradeAssessment(input: { assessmentId: string; assessedAt: string; market: EvidenceEnvelope<MarketObservation>; social?: EvidenceEnvelope<SocialObservation>[]; wallets?: EvidenceEnvelope<WalletObservation>[]; network?: EvidenceEnvelope<NetworkHealthObservation>; tradeType: TradeStyle; strategyFit: StrategyFit; holderCohort?: HolderCohortSignal; supplyControl?: SupplyControlRisk; attention?: AttentionQuality; thesis: string; invalidation: ThesisInvalidation; positionPlan: PositionPlan; confidence: number }): MemeTradeAssessment {
  const marketActivityQuality = assessMarketActivity(input.market.payload)
  const supplyControl = input.supplyControl ?? assessSupplyControl({})
  const holderCohort = input.holderCohort ?? { score: .5, profitableTrackedWallets: 0, accumulatingWallets: 0, distributingWallets: 0, reasons: [] }
  const attention = input.attention ?? assessAttentionQuality({})
  const riskAssessment = evaluateRisk({ marketIntegrity: 1 - (input.market.payload.anomalyScore ?? 0), liquidityRisk: 1 - marketActivityQuality.liquidityScore, supplyControlRisk: supplyControl.score, holderConcentrationRisk: 1 - holderCohort.score, walletCohortRisk: 1 - holderCohort.score, socialManipulationRisk: attention.manipulationPenalty, narrativeFragilityRisk: 1 - attention.score, developerRisk: supplyControl.deployerRisk, contractRisk: 0, networkRisk: input.network ? clamp(input.network.payload.riskScore ?? 0) : .5, attentionQuality: attention.score, exitLiquidityRisk: 1 - marketActivityQuality.liquidityScore })
  const evidenceIds = [input.market.observationId, ...(input.social ?? []).map(x => x.observationId), ...(input.wallets ?? []).map(x => x.observationId), ...(input.network ? [input.network.observationId] : [])]
  return { assessmentId: input.assessmentId, assessedAt: input.assessedAt, token: { chainId: input.market.chainId, tokenAddress: input.market.subjectId }, tradeType: input.tradeType, marketActivityQuality, supplyControl, holderCohort, attention, strategyFit: input.strategyFit, riskAssessment, thesis: input.thesis, invalidation: input.invalidation, positionPlan: input.positionPlan, confidence: clamp(input.confidence), evidenceIds, assessmentVersion: 'meme-trader-assessment-v1' }
}
