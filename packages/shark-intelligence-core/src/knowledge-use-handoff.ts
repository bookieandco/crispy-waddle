import type { SharkKnowledgeUseContext } from './knowledge-use-preparation'
import type { SharkKnowledgeEligibility } from './knowledge-use-eligibility'

export type SharkReasoningHandoff = Readonly<{
  queryNodeId: string
  experienceIds: readonly string[]
  patterns: readonly string[]
  hypotheses: readonly string[]
  confidence: number
  evidenceBalance: number
  contradictionCount: number
  evidenceStrength: number
  eligibility: SharkKnowledgeEligibility
  historicalEvidencePreserved: true
}>

export function createSharkReasoningHandoff(input: {
  context: SharkKnowledgeUseContext
  eligibility: SharkKnowledgeEligibility
}): SharkReasoningHandoff {
  if (input.eligibility.eligible && input.eligibility.evidenceStrength <= 0) {
    throw new Error('eligible handoff requires positive evidence strength')
  }
  return Object.freeze({
    queryNodeId: input.context.queryNodeId,
    experienceIds: Object.freeze([...input.context.experienceIds]),
    patterns: Object.freeze([...input.context.patterns]),
    hypotheses: Object.freeze([...input.context.hypotheses]),
    confidence: input.context.confidence,
    evidenceBalance: input.context.evidenceBalance,
    contradictionCount: input.context.contradictionCount,
    evidenceStrength: input.eligibility.evidenceStrength,
    eligibility: Object.freeze({ ...input.eligibility }),
    historicalEvidencePreserved: true,
  })
}
