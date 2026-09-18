import { weightSharkExperience, type SharkExperience, type SharkExperienceWeight } from '../experience-ledger'
import { updateSharkExperienceWeights, type SharkExperienceUpdate } from '../experience-updater'
import type { PaperTradeOutcome, TradeAttribution } from './paper-trade-outcome'

export type PaperLearningEvidenceClass = 'SIMULATED_TRADE_OUTCOME'

export type PaperTradeLearningRecord = Readonly<{
  learningRecordId: string
  evidenceClass: PaperLearningEvidenceClass
  simulationAuthority: 'PAPER_ONLY'
  outcomeId: string
  attributionId: string
  assessmentId: string
  decisionProposalId: string
  scenarioId: string
  strategyId: string
  experience: SharkExperience
  evidenceIds: readonly string[]
  createdAt: string
}>

function clamp(n: number): number {
  return Math.max(-1, Math.min(1, n))
}

/**
 * Converts a verified paper outcome into learning evidence without promoting
 * simulation into observed market truth. This adapter is one-way:
 * PaperTradeOutcome -> simulated SharkExperience.
 */
export function createPaperTradeLearningRecord(input: {
  outcome: PaperTradeOutcome
  attribution: TradeAttribution
  scenarioId: string
  strategyId: string
  createdAt: string
}): PaperTradeLearningRecord {
  if (input.outcome.simulationAuthority !== 'PAPER_ONLY' || input.attribution.simulationAuthority !== 'PAPER_ONLY') {
    throw new Error('paper_learning_requires_simulation_authority')
  }
  if (input.attribution.outcomeId !== input.outcome.outcomeId) throw new Error('paper_learning_attribution_lineage_mismatch')
  if (input.outcome.label === 'OPEN' || input.outcome.label === 'INVALID') throw new Error('paper_learning_requires_closed_valid_outcome')
  if (!input.scenarioId.trim() || !input.strategyId.trim() || !input.createdAt) throw new Error('paper_learning_identity_required')

  const evidenceIds = [...new Set([...input.outcome.evidenceIds, ...input.attribution.evidenceIds])]
  if (evidenceIds.length === 0) throw new Error('paper_learning_evidence_required')

  const outcomeScore = clamp(input.outcome.realizedRoi)
  const excursionCoverage = input.outcome.maxFavorableExcursion !== 0 || input.outcome.maxAdverseExcursion !== 0 ? 1 : 0.7
  const attributionCoverage = input.attribution.exitReasons.length > 0 ? 1 : 0.8
  const confidence = Math.max(0, Math.min(1, excursionCoverage * attributionCoverage))

  const experience: SharkExperience = Object.freeze({
    experienceId: `paper-experience:${input.outcome.outcomeId}`,
    occurredAt: input.outcome.evaluatedAt,
    scenarioId: input.scenarioId,
    strategyId: input.strategyId,
    outcomeScore,
    confidence,
    provenanceComplete: true,
  })

  return Object.freeze({
    learningRecordId: `paper-learning:${input.outcome.outcomeId}`,
    evidenceClass: 'SIMULATED_TRADE_OUTCOME' as const,
    simulationAuthority: 'PAPER_ONLY' as const,
    outcomeId: input.outcome.outcomeId,
    attributionId: input.attribution.attributionId,
    assessmentId: input.outcome.assessmentId,
    decisionProposalId: input.outcome.decisionProposalId,
    scenarioId: input.scenarioId,
    strategyId: input.strategyId,
    experience,
    evidenceIds: Object.freeze(evidenceIds),
    createdAt: input.createdAt,
  })
}

export function weightPaperTradeLearningRecord(
  record: PaperTradeLearningRecord,
  now: Date,
  relevance: number,
): SharkExperienceWeight {
  if (record.evidenceClass !== 'SIMULATED_TRADE_OUTCOME' || record.simulationAuthority !== 'PAPER_ONLY') {
    throw new Error('paper_learning_evidence_class_required')
  }
  return weightSharkExperience(record.experience, now, relevance)
}

export function updateExperienceFromPaperTrade(input: {
  history: SharkExperienceWeight[]
  record: PaperTradeLearningRecord
  now: Date
  relevance: number
}): SharkExperienceUpdate {
  const weighted = weightPaperTradeLearningRecord(input.record, input.now, input.relevance)
  return updateSharkExperienceWeights({ history: input.history, newExperience: weighted })
}

/**
 * Explicit guard for downstream belief/pattern code. Paper learning can update
 * simulation-calibrated strategy knowledge, but cannot be represented as an
 * observed launch outcome, chain fact, wallet fact, or canonical market fact.
 */
export function assertPaperLearningMayInfluence(target: 'SIMULATION_STRATEGY' | 'OBSERVED_MARKET_FACT'): void {
  if (target !== 'SIMULATION_STRATEGY') throw new Error('paper_learning_cannot_promote_to_observed_fact')
}
