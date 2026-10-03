import type { EvidenceEnvelope, MarketObservation, SocialObservation, WalletObservation, NetworkHealthObservation } from './contracts'
import type { LiquidityHistory } from './liquidity-history'
import { assessLPControlRisk, type LPControlRisk, type LPControlRiskInput } from './lp-control-risk'
import type { RugProtectionEvidence, RugProtectionResult } from './rug-protection'
import { evaluateRugProtection } from './rug-protection'
import { evaluateRugSelfProtection, type RugCriticalCoverage, type RugModelSignal, type RugRuntimeObservation, type RugSelfProtectionResult, type RugSelfProtectionThresholds } from './rug-self-protection'
import { assessMigrationAwareRisk } from './migration-aware-risk'
import type { MigrationAwareClassification } from './migration-classification'
import type { SyntheticVolumeDiagnostics } from './synthetic-volume-diagnostics'

export type TradeStyle = 'new-pair-speculation' | 'narrative' | 'swing-hold' | 'high-conviction' | 'information-edge'
export type StrategyFit = { score: number; matchedSignals: string[]; conflicts: string[] }
export type ThesisInvalidation = { conditions: string[]; severity: 'low' | 'medium' | 'high' }
export type PositionPlan = { maxPositionFraction: number; entryConditions: string[]; profitTakingConditions: string[]; exitConditions: string[] }
export type MarketActivityQuality = { score: number; volumeScore: number; liquidityScore: number; flowScore: number; buyerGrowthScore?: number; manipulationPenalty: number; reasons: string[] }
export type SupplyControlRisk = { score: number; deployerRisk: number; concentrationRisk: number; bundledSupplyRisk: number; liquidityControlRisk: number; reasons: string[] }
export type HolderCohortSignal = { score: number; profitableTrackedWallets: number; accumulatingWallets: number; distributingWallets: number; medianHoldTimeSeconds?: number; reasons: string[] }
export type AttentionQuality = { score: number; crossSourceConfirmation: number; engagementQuality: number; sourceCredibility: number; manipulationPenalty: number; reasons: string[] }
export type RiskAssessment = { marketIntegrity: number; liquidityRisk: number; supplyControlRisk: number; holderConcentrationRisk: number; walletCohortRisk: number; socialManipulationRisk: number; narrativeFragilityRisk: number; developerRisk: number; contractRisk: number; networkRisk: number; attentionQuality: number; exitLiquidityRisk: number; overallRisk: number; band: 'candidate' | 'watch' | 'high-risk' | 'blocked' }
export type MemeTradeAssessment = { assessmentId: string; assessedAt: string; token: { chainId: string; tokenAddress: string }; tradeType: TradeStyle; marketActivityQuality: MarketActivityQuality; supplyControl: SupplyControlRisk; holderCohort: HolderCohortSignal; attention: AttentionQuality; strategyFit: StrategyFit; riskAssessment: RiskAssessment; rugProtection: RugProtectionResult; syntheticVolumeDiagnostics?: SyntheticVolumeDiagnostics; rugSelfProtection?: RugSelfProtectionResult; lpControlRisk?: LPControlRisk; liquidityHistory?: LiquidityHistory; migrationClassification?: MigrationAwareClassification; thesis: string; invalidation: ThesisInvalidation; positionPlan: PositionPlan; confidence: number; evidenceIds: string[]; assessmentVersion: string }

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
  const reasons: string[] = []
  if (deployerRisk >= .7) reasons.push('historical-deployer-risk-high')
  if (concentrationRisk >= .7) reasons.push('holder-concentration-high')
  if (bundledSupplyRisk >= .7) reasons.push('bundled-supply-risk-high')
  if (liquidityControlRisk >= .7) reasons.push('liquidity-control-risk-high')
  return { deployerRisk, concentrationRisk, bundledSupplyRisk, liquidityControlRisk, score: clamp(.3 * deployerRisk + .3 * concentrationRisk + .2 * bundledSupplyRisk + .2 * liquidityControlRisk), reasons }
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

export function createMemeTradeAssessment(input: {
  assessmentId: string
  assessedAt: string
  market: EvidenceEnvelope<MarketObservation>
  social?: EvidenceEnvelope<SocialObservation>[]
  wallets?: EvidenceEnvelope<WalletObservation>[]
  network?: EvidenceEnvelope<NetworkHealthObservation>
  tradeType: TradeStyle
  strategyFit: StrategyFit
  holderCohort?: HolderCohortSignal
  supplyControl?: SupplyControlRisk
  attention?: AttentionQuality
  lpControlRisk?: LPControlRisk
  lpControlRiskInput?: LPControlRiskInput
  liquidityHistory?: LiquidityHistory
  migrationClassification?: MigrationAwareClassification
  syntheticVolumeDiagnostics?: SyntheticVolumeDiagnostics
  rugProtection?: RugProtectionResult
  rugProtectionInput?: Omit<Parameters<typeof evaluateRugProtection>[0], 'evidence'> & { evidence?: RugProtectionEvidence[] }
  rugSelfProtection?: RugSelfProtectionResult
  rugSelfProtectionInput?: Readonly<{
    coverage: RugCriticalCoverage
    runtime?: readonly RugRuntimeObservation[]
    modelSignals?: readonly RugModelSignal[]
    thresholds?: RugSelfProtectionThresholds
    informationCutoff: string
  }>
  thesis: string
  invalidation: ThesisInvalidation
  positionPlan: PositionPlan
  confidence: number
}): MemeTradeAssessment {
  const synthetic=input.syntheticVolumeDiagnostics
  if(synthetic&&(synthetic.authority!=='FORENSIC_EVIDENCE_ONLY'||synthetic.canAuthorizeTrade!==false||synthetic.canLabelWashTrading!==false))throw new Error('synthetic volume diagnostics authority escalation forbidden')
  const effectiveAnomaly=clamp(Math.max(input.market.payload.anomalyScore??0,synthetic?.calibratedRiskScore??0))
  const marketActivityQuality = assessMarketActivity({...input.market.payload,anomalyScore:effectiveAnomaly})
  const supplyControl = input.supplyControl ?? assessSupplyControl({ liquidityControlRisk: input.lpControlRisk?.score ?? 0 })
  const holderCohort = input.holderCohort ?? { score: .5, profitableTrackedWallets: 0, accumulatingWallets: 0, distributingWallets: 0, reasons: [] }
  const attention = input.attention ?? assessAttentionQuality({})
  const baseEvidence: RugProtectionEvidence[] = input.rugProtectionInput?.evidence ?? [{ source: 'meme-trader', observedAt: input.assessedAt, label: input.market.observationId }]

  let finalLpControlRisk = input.lpControlRisk
  let rugProtection = input.rugProtection ?? evaluateRugProtection({
    ...input.rugProtectionInput,
    liquidityHistory: input.liquidityHistory,
    lpControlRisk: input.lpControlRisk,
    supplyControlRisk: supplyControl.score,
    holderConcentrationRisk: 1 - holderCohort.score,
    marketIntegrityRisk: effectiveAnomaly,
    evidence: baseEvidence,
  })

  if (input.migrationClassification) {
    if (!input.lpControlRiskInput) throw new Error('migration-aware assessment requires authoritative lpControlRiskInput')
    const migrationRisk = assessMigrationAwareRisk({
      lpControlRisk: input.lpControlRiskInput,
      rugProtection: {
        ...input.rugProtectionInput,
        lpBurnPct: input.rugProtectionInput?.lpBurnPct,
        lpLockedPct: input.rugProtectionInput?.lpLockedPct,
        supplyControlRisk: supplyControl.score,
        holderConcentrationRisk: 1 - holderCohort.score,
        marketIntegrityRisk: effectiveAnomaly,
        evidence: baseEvidence,
      },
      migrationClassification: input.migrationClassification,
    })
    finalLpControlRisk = migrationRisk.lpControlRisk
    rugProtection = migrationRisk.rugProtection
  } else if (input.lpControlRiskInput) {
    finalLpControlRisk = assessLPControlRisk(input.lpControlRiskInput)
  }

  const rugSelfProtection = input.rugSelfProtection ?? (input.rugSelfProtectionInput ? evaluateRugSelfProtection({
    rugProtection,
    coverage: input.rugSelfProtectionInput.coverage,
    runtime: input.rugSelfProtectionInput.runtime,
    modelSignals: input.rugSelfProtectionInput.modelSignals,
    thresholds: input.rugSelfProtectionInput.thresholds,
    informationCutoff: input.rugSelfProtectionInput.informationCutoff,
  }) : undefined)
  if (rugSelfProtection && (
    rugSelfProtection.authority !== 'RESEARCH_ONLY' ||
    rugSelfProtection.canAuthorizeTrade !== false ||
    rugSelfProtection.canAuthorizeExit !== false
  )) throw new Error('rug self protection authority escalation forbidden')

  const effectiveLpRisk = finalLpControlRisk?.score ?? 0
  const migrated = input.migrationClassification?.kind === 'LEGITIMATE_MIGRATION' || input.migrationClassification?.kind === 'POOL_MIGRATION'
  const riskAssessment = evaluateRisk({
    // Historical field name is retained for compatibility; semantically this is market-integrity RISK.
    marketIntegrity: effectiveAnomaly,
    liquidityRisk: Math.max(1 - marketActivityQuality.liquidityScore, effectiveLpRisk, migrated ? 0 : input.liquidityHistory?.drainRate ?? 0),
    supplyControlRisk: supplyControl.score,
    holderConcentrationRisk: Math.max(1 - holderCohort.score, supplyControl.concentrationRisk),
    walletCohortRisk: 1 - holderCohort.score,
    socialManipulationRisk: attention.manipulationPenalty,
    narrativeFragilityRisk: 1 - attention.score,
    developerRisk: supplyControl.deployerRisk,
    contractRisk: rugProtection.disposition === 'BLOCK' ? 1 : 0,
    networkRisk: input.network ? clamp(input.network.payload.riskScore ?? 0) : .5,
    attentionQuality: attention.score,
    exitLiquidityRisk: Math.max(1 - marketActivityQuality.liquidityScore, effectiveLpRisk, migrated ? 0 : input.liquidityHistory?.drawdownFromPeak ?? 0),
  })

  if (rugProtection.disposition === 'BLOCK') { riskAssessment.overallRisk = 1; riskAssessment.band = 'blocked' }
  else if (rugProtection.disposition === 'REVIEW' && riskAssessment.band === 'candidate') { riskAssessment.overallRisk = Math.max(riskAssessment.overallRisk, .4); riskAssessment.band = 'watch' }

  if (rugSelfProtection?.action === 'QUARANTINE' || rugSelfProtection?.action === 'BLOCK_NEW_ENTRY' || rugSelfProtection?.action === 'EXIT_RECOMMENDED') { riskAssessment.overallRisk = 1; riskAssessment.band = 'blocked' }
  else if (rugSelfProtection?.action === 'CAUTION' && riskAssessment.band === 'candidate') { riskAssessment.overallRisk = Math.max(riskAssessment.overallRisk, .4); riskAssessment.band = 'watch' }

  const evidenceIds = [...new Set([
    input.market.observationId,
    ...(input.social ?? []).map(x => x.observationId),
    ...(input.wallets ?? []).map(x => x.observationId),
    ...(input.network ? [input.network.observationId] : []),
    ...(input.liquidityHistory?.evidenceIds ?? []),
    ...(finalLpControlRisk?.evidenceIds ?? []),
    ...(input.migrationClassification?.evidenceIds ?? []),
    ...rugProtection.evidenceIds,
    ...(rugSelfProtection?.evidenceIds ?? []),
    ...(synthetic?.evidenceIds ?? []),
  ])]

  return {
    assessmentId: input.assessmentId,
    assessedAt: input.assessedAt,
    token: { chainId: input.market.chainId, tokenAddress: input.market.subjectId },
    tradeType: input.tradeType,
    marketActivityQuality,
    supplyControl,
    holderCohort,
    attention,
    strategyFit: input.strategyFit,
    riskAssessment,
    rugProtection,
    syntheticVolumeDiagnostics:synthetic,
    rugSelfProtection,
    lpControlRisk: finalLpControlRisk,
    liquidityHistory: input.liquidityHistory,
    migrationClassification: input.migrationClassification,
    thesis: input.thesis,
    invalidation: input.invalidation,
    positionPlan: input.positionPlan,
    confidence: clamp(input.confidence),
    evidenceIds,
    assessmentVersion: 'meme-trader-assessment-v6-synthetic-volume-risk',
  }
}
