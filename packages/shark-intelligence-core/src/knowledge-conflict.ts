import type { SharkKnowledgeMatch } from './knowledge-retrieval'

export type SharkKnowledgeConflict = {
  status: 'CONSISTENT' | 'CONFLICT_DETECTED' | 'INSUFFICIENT_KNOWLEDGE'
  knowledgeIds: string[]
  confidenceSpread: number
  disagreement: boolean
  reasons: string[]
  simulated: true
  paperOnly: true
}

export function detectSharkKnowledgeConflict(input: {
  knowledge: SharkKnowledgeMatch[]
  minimumConfidence?: number
  maximumConfidenceSpread?: number
}): SharkKnowledgeConflict {
  const minimumConfidence = input.minimumConfidence ?? 0.7
  const maximumConfidenceSpread = input.maximumConfidenceSpread ?? 0.25
  const relevant = input.knowledge.filter(k => k.usable && k.provenanceComplete && k.confidence >= minimumConfidence)

  if (relevant.length === 0) {
    return { status: 'INSUFFICIENT_KNOWLEDGE', knowledgeIds: [], confidenceSpread: 0, disagreement: false, reasons: ['no sufficiently confident knowledge'], simulated: true, paperOnly: true }
  }

  const confidences = relevant.map(k => k.confidence)
  const confidenceSpread = Math.max(...confidences) - Math.min(...confidences)
  const disagreement = confidenceSpread > maximumConfidenceSpread
  const reasons = disagreement ? ['knowledge confidence disagreement exceeds threshold'] : []

  return {
    status: disagreement ? 'CONFLICT_DETECTED' : 'CONSISTENT',
    knowledgeIds: relevant.map(k => k.knowledgeId),
    confidenceSpread,
    disagreement,
    reasons,
    simulated: true,
    paperOnly: true,
  }
}
