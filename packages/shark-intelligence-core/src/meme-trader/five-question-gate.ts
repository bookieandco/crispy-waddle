import type { MemeTradeAssessment, TradeStyle } from './assessment'

export type FiveQuestionGate = {
  tradeType: { passed: boolean; answer: TradeStyle; reason: string }
  attentionVolumeQuality: { passed: boolean; score: number; reason: string }
  supplyControl: { passed: boolean; score: number; reason: string }
  holderCohort: { passed: boolean; score: number; reason: string }
  invalidation: { passed: boolean; conditions: string[]; reason: string }
  passed: boolean
  blockers: string[]
}

export function evaluateFiveQuestionGate(
  assessment: MemeTradeAssessment,
): FiveQuestionGate {
  const blockers: string[] = []

  const tradeType = {
    passed: Boolean(assessment.tradeType),
    answer: assessment.tradeType,
    reason: assessment.tradeType
      ? `Trade classified as ${assessment.tradeType}.`
      : 'Trade type is missing.',
  }
  if (!tradeType.passed) blockers.push('trade-type-missing')

  const attentionScore = assessment.attention.score
  const attentionVolumeQuality = {
    passed: attentionScore >= 0.5 && assessment.marketActivityQuality.score >= 0.5,
    score: Math.min(attentionScore, assessment.marketActivityQuality.score),
    reason:
      attentionScore >= 0.5 && assessment.marketActivityQuality.score >= 0.5
        ? 'Attention and market activity meet the minimum quality threshold.'
        : 'Attention or market activity quality is below threshold.',
  }
  if (!attentionVolumeQuality.passed) blockers.push('attention-volume-quality')

  const supplyControl = {
    passed: assessment.supplyControl.score < 0.7,
    score: assessment.supplyControl.score,
    reason:
      assessment.supplyControl.score < 0.7
        ? 'Supply-control risk is below the hard gate.'
        : 'Supply-control risk is too high.',
  }
  if (!supplyControl.passed) blockers.push('supply-control')

  const holderCohort = {
    passed: assessment.holderCohort.score >= 0.4,
    score: assessment.holderCohort.score,
    reason:
      assessment.holderCohort.score >= 0.4
        ? 'Holder cohort signal is sufficiently supportive or neutral.'
        : 'Holder cohort signal is too weak or adverse.',
  }
  if (!holderCohort.passed) blockers.push('holder-cohort')

  const conditions = assessment.invalidation.conditions
  const invalidation = {
    passed: conditions.length > 0,
    conditions,
    reason:
      conditions.length > 0
        ? 'Explicit thesis invalidation conditions are defined.'
        : 'No thesis invalidation conditions are defined.',
  }
  if (!invalidation.passed) blockers.push('invalidation-missing')

  if (assessment.riskAssessment.band === 'blocked') blockers.push('risk-blocked')

  return {
    tradeType,
    attentionVolumeQuality,
    supplyControl,
    holderCohort,
    invalidation,
    passed: blockers.length === 0,
    blockers,
  }
}
