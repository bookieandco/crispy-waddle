import type { CorporateRelationship, CorporateRelationshipGraph } from './corporate-relationship-intelligence'

export interface CorporateGraphMatch {
  entityId: string
  distance: number
  relationshipPath: CorporateRelationship[]
}

/** Breadth-first traversal for bounded corporate relationship discovery. */
export function traverseCorporateGraph(graph: CorporateRelationshipGraph, startEntityId: string, maxDepth = 2): CorporateGraphMatch[] {
  if (!startEntityId) throw new Error('startEntityId is required')
  if (maxDepth < 0) throw new Error('maxDepth must be non-negative')
  const results: CorporateGraphMatch[] = []
  const visited = new Set<string>([startEntityId])
  const queue: Array<{ entityId: string; depth: number; path: CorporateRelationship[] }> = [{ entityId: startEntityId, depth: 0, path: [] }]
  while (queue.length) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) continue
    for (const relationship of graph.relationships) {
      let next: string | undefined
      if (relationship.fromEntityId === current.entityId) next = relationship.toEntityId
      else if (relationship.toEntityId === current.entityId) next = relationship.fromEntityId
      if (!next || visited.has(next)) continue
      visited.add(next)
      const path = [...current.path, relationship]
      results.push({ entityId: next, distance: current.depth + 1, relationshipPath: path })
      queue.push({ entityId: next, depth: current.depth + 1, path })
    }
  }
  return results
}

export function findOpportunityConnections(graph: CorporateRelationshipGraph, companyEntityId: string, maxDepth = 2): CorporateGraphMatch[] {
  return traverseCorporateGraph(graph, companyEntityId, maxDepth).filter((match) => match.relationshipPath.some((relationship) => relationship.type === 'PROCUREMENT_RECIPIENT_OF'))
}
