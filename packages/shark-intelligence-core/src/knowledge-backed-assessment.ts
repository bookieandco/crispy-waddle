import { detectSharkKnowledgeConflict, type SharkKnowledgeConflict } from './knowledge-conflict'
import type { SharkKnowledgeMatch } from './knowledge-retrieval'

export type SharkKnowledgeBackedAssessment = {
  assessmentId: string
  opportunityId: string
  strategyId: string
  knowledgeIds: string[]
  status: 'KNOWLEDGE_BACKED' | 'ASSESSMENT_WITH_UNCERTAINTY' | 'INSUFFICIENT_KNOWLEDGE' | 'KNOWLEDGE_CONFLICT'
  relevanceScore: number
  confidence: number
  uncertainty: number
  provenanceComplete: boolean
  conflict: SharkKnowledgeConflict
  simulated: true
  paperOnly: true
}

export function assessWithSharkKnowledge(input: {
  assessmentId: string
  opportunityId: string
  strategyId: string
  knowledge: SharkKnowledgeMatch[]
  uncertainty?: number
}): SharkKnowledgeBackedAssessment {
  if (!input.assessmentId.trim() || !input.opportunityId.trim()) throw new Error('assessment and opportunity ids are required')
  const uncertainty = input.uncertainty ?? 0
  if (!Number.isFinite(uncertainty) || uncertainty < 0 || uncertainty > 1) throw new Error('uncertainty must be between 0 and 1')

  const relevant = input.knowledge.filter(item => item.strategyId === input.strategyId && item.usable && item.provenanceComplete)
  const conflict = detectSharkKnowledgeConflict({ knowledge: relevant })
  if (relevant.length === 0) return { assessmentId: input.assessmentId, opportunityId: input.opportunityId, strategyId: input.strategyId, knowledgeIds: [], status: 'INSUFFICIENT_KNOWLEDGE', relevanceScore: 0, confidence: 0, uncertainty, provenanceComplete: false, conflict, simulated: true, paperOnly: true }
  if (conflict.disagreement) return { assessmentId: input.assessmentId, opportunityId: input.opportunityId, strategyId: input.strategyId, knowledgeIds: relevant.map(k => k.knowledgeId), status: 'KNOWLEDGE_CONFLICT', relevanceScore: Math.max(...relevant.map(k => k.relevanceScore)), confidence: 0, uncertainty: Math.max(uncertainty, conflict.confidenceSpread), provenanceComplete: true, conflict, simulated: true, paperOnly: true }

  const relevanceScore = Math.max(...relevant.map(item => item.relevanceScore))
  const confidence = relevant.reduce((sum, item) => sum + item.confidence, 0) / relevant.length
  const status = uncertainty > 0.5 || confidence < 0.7 ? 'ASSESSMENT_WITH_UNCERTAINTY' : 'KNOWLEDGE_BACKED'
  return { assessmentId: input.assessmentId, opportunityId: input.opportunityId, strategyId: input.strategyId, knowledgeIds: relevant.map(item => item.knowledgeId), status, relevanceScore, confidence, uncertainty, provenanceComplete: true, conflict, simulated: true, paperOnly: true }
}
