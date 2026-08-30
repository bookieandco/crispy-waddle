import type { SharkKnowledgeUseContext } from './knowledge-use-preparation'

export type SharkKnowledgeEligibility = {
  eligible: boolean
  reason: 'sufficient-evidence' | 'insufficient-evidence' | 'unresolved-contradiction'
  evidenceStrength: number
}

export function evaluateSharkKnowledgeEligibility(input: {
  context: SharkKnowledgeUseContext
  minimumEvidenceStrength?: number
  allowUnresolvedContradictions?: boolean
}): SharkKnowledgeEligibility {
  const minimum = input.minimumEvidenceStrength ?? 0.5
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1) throw new Error('minimum evidence strength must be between 0 and 1')
  const strength = Math.max(0, Math.min(1, input.context.confidence * ((input.context.evidenceBalance + 1) / 2)))
  if (input.context.contradictionCount > 0 && !input.allowUnresolvedContradictions) {
    return { eligible: false, reason: 'unresolved-contradiction', evidenceStrength: strength }
  }
  if (strength < minimum || input.context.experienceIds.length === 0) {
    return { eligible: false, reason: 'insufficient-evidence', evidenceStrength: strength }
  }
  return { eligible: true, reason: 'sufficient-evidence', evidenceStrength: strength }
}
