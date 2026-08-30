import type { SharkKnowledgeNode, SharkKnowledgeRelation } from './knowledge-graph'

export type SharkKnowledgeNeighborhood = {
  nodeIds: string[]
  relationIds: string[]
  depth: number
}

export function traverseSharkKnowledgeGraph(input: {
  startNodeId: string
  nodes: SharkKnowledgeNode[]
  relations: SharkKnowledgeRelation[]
  maxDepth?: number
}): SharkKnowledgeNeighborhood {
  if (!input.nodes.some(n => n.nodeId === input.startNodeId)) throw new Error('start node must exist')
  const maxDepth = input.maxDepth ?? 2
  if (!Number.isInteger(maxDepth) || maxDepth < 0) throw new Error('maxDepth must be a non-negative integer')
  const visited = new Set([input.startNodeId])
  const relationIds = new Set<string>()
  let frontier = new Set([input.startNodeId])
  for (let depth = 0; depth < maxDepth; depth++) {
    const next = new Set<string>()
    for (const relation of input.relations) {
      if (!frontier.has(relation.fromNodeId) && !frontier.has(relation.toNodeId)) continue
      relationIds.add(relation.relationId)
      const neighbor = frontier.has(relation.fromNodeId) ? relation.toNodeId : relation.fromNodeId
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        next.add(neighbor)
      }
    }
    frontier = next
    if (frontier.size === 0) break
  }
  return { nodeIds: [...visited], relationIds: [...relationIds], depth: maxDepth }
}
