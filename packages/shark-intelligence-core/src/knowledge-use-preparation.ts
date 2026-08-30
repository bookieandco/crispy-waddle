import type { SharkContextPackage } from './contextual-recall-synthesis'
import type { SharkContradictionAwareContext } from './contradiction-aware-context'

export type SharkKnowledgeUseContext = {
  queryNodeId: string
  experienceIds: string[]
  patterns: string[]
  hypotheses: string[]
  confidence: number
  evidenceBalance: number
  contradictionCount: number
  historicalEvidencePreserved: true
}

export function prepareSharkKnowledgeForReasoning(input: {
  context: SharkContextPackage
  evidence: SharkContradictionAwareContext
}): SharkKnowledgeUseContext {
  if (input.context.queryNodeId !== input.context.queryNodeId.trim()) throw new Error('query node id must be trimmed')
  const experienceIds = [...new Set([
    ...input.context.sourceExperienceIds,
    ...input.evidence.supportingExperienceIds,
    ...input.evidence.conflictingExperienceIds,
  ])]
  return {
    queryNodeId: input.context.queryNodeId,
    experienceIds,
    patterns: [...input.context.patterns],
    hypotheses: [...input.context.hypotheses],
    confidence: input.context.confidence,
    evidenceBalance: input.evidence.balance,
    contradictionCount: input.evidence.conflictingExperienceIds.length,
    historicalEvidencePreserved: true,
  }
}
