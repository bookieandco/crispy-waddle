export type SharkKnowledgeStage = 'candidate' | 'training' | 'validated' | 'usable_for_assessment'

export type SharkKnowledgeEvidence = {
  simulations: number
  independentScenarios: number
  positiveOutcomes: number
  maxDrawdownPct: number
  maxAllowedDrawdownPct: number
  reconciliationFailures: number
  provenanceComplete: boolean
  deterministicReplayConfirmed: boolean
}

export type SharkKnowledgePromotionResult = {
  stage: SharkKnowledgeStage
  promotable: boolean
  reasons: string[]
  evidence: SharkKnowledgeEvidence
  simulated: true
}

export function evaluateSharkKnowledgePromotion(input: {
  currentStage: SharkKnowledgeStage
  evidence: SharkKnowledgeEvidence
  minimumSimulations: number
  minimumIndependentScenarios: number
  minimumPositiveOutcomes: number
}): SharkKnowledgePromotionResult {
  const { evidence } = input
  const reasons: string[] = []
  if (evidence.simulations < input.minimumSimulations) reasons.push('insufficient simulations')
  if (evidence.independentScenarios < input.minimumIndependentScenarios) reasons.push('insufficient independent scenarios')
  if (evidence.positiveOutcomes < input.minimumPositiveOutcomes) reasons.push('insufficient positive outcomes')
  if (evidence.maxDrawdownPct > evidence.maxAllowedDrawdownPct) reasons.push('drawdown threshold exceeded')
  if (evidence.reconciliationFailures > 0) reasons.push('unresolved reconciliation failures')
  if (!evidence.provenanceComplete) reasons.push('incomplete provenance')
  if (!evidence.deterministicReplayConfirmed) reasons.push('deterministic replay not confirmed')

  const promotable = reasons.length === 0
  let stage: SharkKnowledgeStage = input.currentStage
  if (promotable) stage = 'usable_for_assessment'
  else if (evidence.simulations > 0) stage = 'training'
  else stage = 'candidate'

  return { stage, promotable, reasons, evidence, simulated: true }
}
