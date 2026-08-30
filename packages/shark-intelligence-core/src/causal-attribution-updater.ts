export type SharkCausalHypothesis = {
  hypothesisId: string
  statement: string
  confidence: number
  supportingExperienceIds: string[]
  contradictingExperienceIds: string[]
  updateCount: number
}

export function updateSharkCausalAttribution(input: {
  hypothesis: SharkCausalHypothesis
  experienceId: string
  supports: boolean
  strength?: number
}): SharkCausalHypothesis {
  const strength = input.strength ?? 0.1
  if (!input.hypothesis.hypothesisId.trim() || !input.hypothesis.statement.trim()) throw new Error('causal hypothesis identity is required')
  if (!input.experienceId.trim()) throw new Error('experience id is required')
  if (!Number.isFinite(strength) || strength <= 0 || strength > 1) throw new Error('strength must be between 0 and 1')
  const supporting = new Set(input.hypothesis.supportingExperienceIds)
  const contradicting = new Set(input.hypothesis.contradictingExperienceIds)
  if (input.supports) {
    supporting.add(input.experienceId)
    contradicting.delete(input.experienceId)
  } else {
    contradicting.add(input.experienceId)
    supporting.delete(input.experienceId)
  }
  const delta = input.supports ? strength * (1 - input.hypothesis.confidence) : strength * input.hypothesis.confidence
  const confidence = Math.max(0, Math.min(1, input.hypothesis.confidence + (input.supports ? delta : -delta)))
  return { ...input.hypothesis, confidence, supportingExperienceIds: [...supporting], contradictingExperienceIds: [...contradicting], updateCount: input.hypothesis.updateCount + 1 }
}
