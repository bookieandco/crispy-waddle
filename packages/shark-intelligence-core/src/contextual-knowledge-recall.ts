import type { SharkKnowledgeNode, SharkKnowledgeRelation } from './knowledge-graph'
import { retrieveRelevantSharkKnowledge } from './knowledge-graph-retrieval'

export type SharkContextualRecall = {
  queryNodeId: string
  relevantNodeIds: string[]
  relevantRelationIds: string[]
  relevanceScores: Record<string, number>
  maxDepth: number
  minimumScore: number
}

export function recallSharkContext(input: {
  queryNodeId: string
  nodes: SharkKnowledgeNode[]
  relations: SharkKnowledgeRelation[]
  maxDepth?: number
  minimumScore?: number
}): SharkContextualRecall {
  const maxDepth = input.maxDepth ?? 2
  const minimumScore = input.minimumScore ?? 0.25
  const result = retrieveRelevantSharkKnowledge({
    startNodeId: input.queryNodeId,
    nodes: input.nodes,
    relations: input.relations,
    maxDepth,
    minimumScore,
  })
  return {
    queryNodeId: input.queryNodeId,
    relevantNodeIds: result.nodeIds,
    relevantRelationIds: result.relationIds,
    relevanceScores: { ...result.scores },
    maxDepth,
    minimumScore,
  }
}
