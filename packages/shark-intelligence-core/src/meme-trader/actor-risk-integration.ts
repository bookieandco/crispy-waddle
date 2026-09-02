import type { MemeTradeAssessment, SupplyControlRisk, HolderCohortSignal } from './assessment'
import type { LaunchBehaviorSignal } from './wallet-launch-pipeline'
import type { ActorOutcomeHistory } from './launch-outcome-engine'
import type { LPControlRisk } from './lp-control-risk'
import type { RugProtectionResult } from './rug-protection'
import type { LPWithdrawalAttribution } from './lp-withdrawal-attribution'
import type { MigrationAwareClassification } from './migration-classification'

export type ActorRiskIntelligence = { launchBehavior?: LaunchBehaviorSignal[]; outcomeHistory?: ActorOutcomeHistory[]; lpControlRisk?: LPControlRisk; rugProtection?: RugProtectionResult; verifiedLPWithdrawals?: LPWithdrawalAttribution[]; migrationClassifications?: Record<string, MigrationAwareClassification>; top10HolderPct?: number; bundledSupplyRisk?: number; profitableTrackedWallets?: number; accumulatingWallets?: number; distributingWallets?: number; evidenceIds?: string[] }
const clamp = (n: number) => Math.max(0, Math.min(1, n))

const isVerifiedMigration = (classification?: MigrationAwareClassification) => Boolean(
  classification && classification.confidence >= 0.7 &&
  (classification.kind === 'LEGITIMATE_MIGRATION' || classification.kind === 'POOL_MIGRATION') &&
  classification.hardBlockRug === false,
)

export function applyActorRiskIntelligence(assessment: MemeTradeAssessment, actor: ActorRiskIntelligence): MemeTradeAssessment {
  const signals = actor.launchBehavior ?? []
  const histories = actor.outcomeHistory ?? []
  const verifiedWithdrawals = (actor.verifiedLPWithdrawals ?? []).filter(item => item.developerAssociation === 'MATCHED' && item.ownerBefore && item.lpStateEventId && item.lpTokenAccount && item.confidence >= 0.7)
  const migrationClassifications = actor.migrationClassifications ?? {}
  const migrationSuppressedWithdrawals = verifiedWithdrawals.filter(item => {
    const classification = migrationClassifications[item.raydiumWithdrawalEventId ?? ''] ?? migrationClassifications[item.signature]
    return isVerifiedMigration(classification) && (
      classification?.withdrawalEventId === item.raydiumWithdrawalEventId ||
      classification?.withdrawalSignature === item.signature
    )
  })
  const developerWithdrawals = verifiedWithdrawals.filter(item => !migrationSuppressedWithdrawals.includes(item))
  const signalConfidence = signals.reduce((sum, s) => sum + s.confidence, 0)
  const signalBadRate = signalConfidence ? signals.reduce((sum, s) => sum + (s.rugRate ?? 0) * s.confidence, 0) / signalConfidence : 0
  const historyConfidence = histories.reduce((sum, h) => sum + h.confidence, 0)
  const historyBadRate = historyConfidence ? histories.reduce((sum, h) => sum + (h.rugRate + h.pumpAndDumpRate) * h.confidence, 0) / historyConfidence : 0
  const developerWithdrawalRisk = developerWithdrawals.length > 0 ? 0.8 : 0
  const deployerRisk = clamp(Math.max(signalBadRate, historyBadRate, developerWithdrawalRisk))
  const concentrationRisk = clamp((actor.top10HolderPct ?? 0) / 100)
  const bundledSupplyRisk = clamp(actor.bundledSupplyRisk ?? 0)
  const lpRisk = clamp(actor.lpControlRisk?.score ?? 0)
  const supplyControl: SupplyControlRisk = { deployerRisk: Math.max(assessment.supplyControl.deployerRisk, deployerRisk), concentrationRisk: Math.max(assessment.supplyControl.concentrationRisk, concentrationRisk), bundledSupplyRisk: Math.max(assessment.supplyControl.bundledSupplyRisk, bundledSupplyRisk), liquidityControlRisk: Math.max(assessment.supplyControl.liquidityControlRisk, lpRisk), score: 0, reasons: [...assessment.supplyControl.reasons] }
  supplyControl.score = clamp(.3 * supplyControl.deployerRisk + .3 * supplyControl.concentrationRisk + .2 * supplyControl.bundledSupplyRisk + .2 * supplyControl.liquidityControlRisk)
  if (deployerRisk > 0) supplyControl.reasons.push(`historical-actor-bad-launch-rate:${deployerRisk.toFixed(3)}`)
  if (developerWithdrawals.length > 0) supplyControl.reasons.push(`verified-developer-lp-withdrawal:${developerWithdrawals.length}`)
  if (migrationSuppressedWithdrawals.length > 0) supplyControl.reasons.push(`migration-suppressed-developer-lp-withdrawal:${migrationSuppressedWithdrawals.length}`)
  if (histories.some(h => h.outcomeCoverage < 0.5)) supplyControl.reasons.push('actor-outcome-history-has-limited-label-coverage')
  if (concentrationRisk > 0.45) supplyControl.reasons.push('top-holder-concentration-from-actor-analysis')
  if (lpRisk > 0.5) supplyControl.reasons.push('high-lp-control-risk')

  const holderCohort: HolderCohortSignal = { ...assessment.holderCohort, profitableTrackedWallets: Math.max(assessment.holderCohort.profitableTrackedWallets, actor.profitableTrackedWallets ?? 0), accumulatingWallets: Math.max(assessment.holderCohort.accumulatingWallets, actor.accumulatingWallets ?? 0), distributingWallets: Math.max(assessment.holderCohort.distributingWallets, actor.distributingWallets ?? 0), reasons: [...assessment.holderCohort.reasons] }
  if (holderCohort.distributingWallets > holderCohort.accumulatingWallets) holderCohort.reasons.push('tracked-actor-distribution-exceeds-accumulation')
  if (signals.some(s => (s.earlyBuyerRepeatRate ?? 0) >= 0.5)) holderCohort.reasons.push('historical-early-buyer-repetition-detected')

  const risk = { ...assessment.riskAssessment }
  risk.supplyControlRisk = Math.max(risk.supplyControlRisk, supplyControl.score)
  risk.developerRisk = Math.max(risk.developerRisk, deployerRisk)
  risk.liquidityRisk = Math.max(risk.liquidityRisk, lpRisk)
  risk.exitLiquidityRisk = Math.max(risk.exitLiquidityRisk, lpRisk)
  risk.contractRisk = Math.max(risk.contractRisk, actor.rugProtection?.disposition === 'BLOCK' ? 1 : 0)
  risk.holderConcentrationRisk = Math.max(risk.holderConcentrationRisk, concentrationRisk)
  risk.walletCohortRisk = Math.max(risk.walletCohortRisk, deployerRisk)
  if (actor.rugProtection?.disposition === 'BLOCK') risk.overallRisk = 1
  else risk.overallRisk = clamp(.15 * risk.marketIntegrity + .12 * risk.liquidityRisk + .14 * risk.supplyControlRisk + .10 * risk.holderConcentrationRisk + .08 * risk.walletCohortRisk + .10 * risk.socialManipulationRisk + .07 * risk.narrativeFragilityRisk + .06 * risk.developerRisk + .05 * risk.contractRisk + .05 * risk.networkRisk + .04 * (1 - risk.attentionQuality) + .04 * risk.exitLiquidityRisk)
  risk.band = risk.overallRisk >= .8 ? 'blocked' : risk.overallRisk >= .6 ? 'high-risk' : risk.overallRisk >= .4 ? 'watch' : 'candidate'

  const evidenceIds = [...new Set([...assessment.evidenceIds, ...(actor.evidenceIds ?? []), ...signals.flatMap(s => s.evidenceIds), ...histories.flatMap(h => h.evidenceIds), ...verifiedWithdrawals.flatMap(w => w.evidenceIds), ...migrationSuppressedWithdrawals.flatMap(w => w.evidenceIds), ...Object.values(migrationClassifications).flatMap(c => c.evidenceIds), ...(actor.lpControlRisk?.evidenceIds ?? []), ...(actor.rugProtection?.evidenceIds ?? [])])]
  return { ...assessment, supplyControl, holderCohort, riskAssessment: risk, evidenceIds, assessmentVersion: 'meme-trader-assessment-v5-migration-aware-actor-risk' }
}
