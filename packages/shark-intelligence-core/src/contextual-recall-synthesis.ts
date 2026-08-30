import type { SharkKnowledgeNode } from './knowledge-graph'
import type { SharkRankedRecall } from './contextual-recall-ranking'

export type SharkContextPackage = {
  queryNodeId: string
  rankedExperienceIds: string[]
  patterns: string[]
  hypotheses: string[]
  confidence: number
  contradictionCount: number
  sourceExperienceIds: string[]
}

export function synthesizeSharkContext(input: {
  queryNodeId: string
  ranked: SharkRankedRecall[]
  nodes: SharkKnowledgeNode[]
  contradictionExperienceIds?: string[]
}): SharkContextPackage {
  if (!input.queryNodeId.trim()) throw new Error('query node id is required')
  const contradictionIds = new Set(input.contradictionExperienceIds ?? [])
  const ids = input.ranked.map(r => r.experienceId)
  const patterns = input.nodes.filter(n => n.nodeType === 'PATTERN' && ids.includes(n.nodeId)).map(n => n.nodeId)
  const hypotheses = input.nodes.filter(n => n.nodeType === 'HYPOTHESIS' && ids.includes(n.nodeId)).map(n => n.nodeId)
  const confidence = input.ranked.length ? input.ranked.reduce((sum, r) => sum + r.score, 0) / input.ranked.length : 0
  return {
    queryNodeId: input.queryNodeId,
    rankedExperienceIds: ids,
    patterns,
    hypotheses,
    confidence,
    contradictionCount: ids.filter(id => contradictionIds.has(id)).length,
    sourceExperienceIds: [...ids],
  }
}
