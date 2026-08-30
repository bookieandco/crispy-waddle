export type SharkExperienceProvenance = {
  experienceId: string
  source: 'OBSERVED' | 'SIMULATED' | 'IMPORTED'
  occurredAt: string
  evidenceIds: string[]
  observationCount: number
  causalHypotheses: string[]
  attributionConfidence: number
}

export function createSharkExperienceProvenance(input: SharkExperienceProvenance): SharkExperienceProvenance {
  if (!input.experienceId.trim()) throw new Error('experience id is required')
  if (!['OBSERVED', 'SIMULATED', 'IMPORTED'].includes(input.source)) throw new Error('invalid experience source')
  if (!Number.isFinite(input.attributionConfidence) || input.attributionConfidence < 0 || input.attributionConfidence > 1) throw new Error('attribution confidence must be between 0 and 1')
  if (!Number.isInteger(input.observationCount) || input.observationCount < 1) throw new Error('observation count must be positive')
  if (input.evidenceIds.some(id => !id.trim())) throw new Error('evidence ids must be non-empty')
  if (input.causalHypotheses.some(hypothesis => !hypothesis.trim())) throw new Error('causal hypotheses must be non-empty')
  if (Number.isNaN(new Date(input.occurredAt).getTime())) throw new Error('occurredAt must be a valid date')
  return { ...input, evidenceIds: [...input.evidenceIds], causalHypotheses: [...input.causalHypotheses] }
}
