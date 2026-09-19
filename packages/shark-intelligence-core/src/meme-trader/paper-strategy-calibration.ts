import { synthesizeSharkExperiencePattern, type SharkExperienceSynthesis } from '../experience-synthesis'
import { updateSharkPatternFromExperience, type SharkPatternUpdate } from '../pattern-updater'
import { evaluateSharkScenarioGeneralization, type SharkGeneralizationResult, type SharkScenario } from '../scenario-generalization'
import { updateSharkCausalAttribution, type SharkCausalHypothesis } from '../causal-attribution-updater'
import type { SharkExperienceWeight } from '../experience-ledger'
import type { PaperTradeLearningRecord } from './paper-trade-learning'

export type PaperStrategyCalibration = Readonly<{
  calibrationId: string
  simulationAuthority: 'PAPER_ONLY'
  strategyId: string
  pattern: SharkExperienceSynthesis
  generalization: SharkGeneralizationResult
  recommendedConfidence: number | null
  status: 'INSUFFICIENT_EVIDENCE' | 'SIMULATION_SUPPORTED' | 'SIMULATION_MIXED' | 'OUT_OF_DISTRIBUTION'
  experienceIds: readonly string[]
  calibratedAt: string
}>

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * StrategyLab-equivalent calibration for SHARK paper trades. It intentionally
 * returns a recommendation rather than mutating the canonical strategy registry.
 */
export function calibratePaperStrategy(input: {
  strategyId: string
  weightedExperiences: SharkExperienceWeight[]
  trainingScenarios: SharkScenario[]
  candidateScenario: SharkScenario
  calibratedAt: string
  minimumExperiences?: number
}): PaperStrategyCalibration {
  if (!input.strategyId.trim() || input.candidateScenario.strategyId !== input.strategyId) {
    throw new Error('paper_calibration_strategy_identity_mismatch')
  }
  const experiences = input.weightedExperiences.filter(e => e.strategyId === input.strategyId)
  const pattern = synthesizeSharkExperiencePattern({
    patternId: `paper-pattern:${input.strategyId}`,
    experiences,
    minimumExperiences: input.minimumExperiences,
  })
  const generalization = evaluateSharkScenarioGeneralization({
    trainingScenarios: input.trainingScenarios,
    candidate: input.candidateScenario,
  })

  let status: PaperStrategyCalibration['status'] = 'INSUFFICIENT_EVIDENCE'
  if (generalization.status === 'OUT_OF_DISTRIBUTION') status = 'OUT_OF_DISTRIBUTION'
  else if (pattern.status === 'SUPPORTED_PATTERN' && generalization.status === 'GENERALIZED') status = 'SIMULATION_SUPPORTED'
  else if (pattern.status === 'MIXED_PATTERN') status = 'SIMULATION_MIXED'

  const direction = pattern.averageOutcome > 0 ? 1 : pattern.averageOutcome < 0 ? -1 : 0
  const evidenceStrength = pattern.patternConfidence * generalization.similarityScore
  const recommendedConfidence = status === 'SIMULATION_SUPPORTED' || status === 'SIMULATION_MIXED'\n    ? clamp01(0.5 + direction * 0.5 * evidenceStrength)\n    : null

  return Object.freeze({
    calibrationId: `paper-calibration:${input.strategyId}:${input.calibratedAt}`,
    simulationAuthority: 'PAPER_ONLY' as const,
    strategyId: input.strategyId,
    pattern,
    generalization,
    recommendedConfidence,
    status,
    experienceIds: Object.freeze(experiences.map(e => e.experienceId)),
    calibratedAt: input.calibratedAt,
  })
}

export function updatePaperPattern(input: {
  pattern: SharkExperienceSynthesis
  record: PaperTradeLearningRecord
  similarity: number
}): SharkPatternUpdate {
  if (input.record.simulationAuthority !== 'PAPER_ONLY') throw new Error('paper_pattern_requires_simulation')
  return updateSharkPatternFromExperience({
    pattern: input.pattern,
    experienceOutcome: input.record.experience.outcomeScore,
    experienceId: input.record.experience.experienceId,
    similarity: input.similarity,
  })
}

export function updatePaperCausalHypothesis(input: {
  hypothesis: SharkCausalHypothesis
  record: PaperTradeLearningRecord
  supports: boolean
  strength?: number
}): SharkCausalHypothesis {
  if (input.record.simulationAuthority !== 'PAPER_ONLY') throw new Error('paper_causal_update_requires_simulation')
  return updateSharkCausalAttribution({
    hypothesis: input.hypothesis,
    experienceId: input.record.experience.experienceId,
    supports: input.supports,
    strength: input.strength,
  })
}

/**
 * Belief promotion is intentionally absent here. A paper calibration may be
 * consumed as simulation context, but applyValidatedSharkBeliefUpdate must not
 * receive it as if it were validated observed-market evidence.
 */
export const PAPER_CALIBRATION_DOES_NOT_VALIDATE_MARKET_BELIEFS = true as const
