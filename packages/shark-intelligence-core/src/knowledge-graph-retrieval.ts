import type { SharkKnowledgeNode, SharkKnowledgeRelation } from './knowledge-graph'

export type SharkRetrievedKnowledge = {
  nodeIds: string[]
  relationIds: string[]
  scores: Record<string, number>
}

export function retrieveRelevantSharkKnowledge(input: {
  startNodeId: string
  nodes: SharkKnowledgeNode[]
  relations: SharkKnowledgeRelation[]
  maxDepth?: number
  minimumScore?: number
}): SharkRetrievedKnowledge {
  if (!input.nodes.some(n => n.nodeId === input.startNodeId)) throw new Error('start node must exist')
  const maxDepth = input.maxDepth ?? 2
  const minimumScore = input.minimumScore ?? 0
  if (!Number.isInteger(maxDepth) || maxDepth < 0) throw new Error('maxDepth must be a non-negative integer')
  if (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 1) throw new Error('minimumScore must be between 0 and 1')
  const scores: Record<string, number> = { [input.startNodeId]: 1 }
  const relationIds = new Set<string>()
  let frontier = new Set([input.startNodeId])
  for (let depth = 0; depth < maxDepth; depth++) {
    const next = new Set<string>()
    for (const relation of input.relations) {
      if (!frontier.has(relation.fromNodeId) && !frontier.has(relation.toNodeId)) continue
      const source = frontier.has(relation.fromNodeId) ? relation.fromNodeId : relation.toNodeId
      const target = source === relation.fromNodeId ? relation.toNodeId : relation.fromNodeId
      const score = (scores[source] ?? 0) * relation.weight
      if (score < minimumScore) continue
      relationIds.add(relation.relationId)
      if ((scores[target] ?? -1) < score) scores[target] = score
      if (!input.nodes.some(n => n.nodeId === target)) continue
      next.add(target)
    }
    frontier = next
    if (frontier.size === 0) break
  }
  return { nodeIds: Object.keys(scores).filter(id => scores[id] >= minimumScore), relationIds: [...relationIds], scores }
}
