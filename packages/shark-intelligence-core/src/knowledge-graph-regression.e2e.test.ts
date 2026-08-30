import { addSharkKnowledgeRelation } from './knowledge-graph'
import { retrieveRelevantSharkKnowledge } from './knowledge-graph-retrieval'

describe('SHARK 1.43-E knowledge graph regression', () => {
  const nodes = [
    { nodeId: 'e1', nodeType: 'EXPERIENCE' as const, label: 'e1' },
    { nodeId: 'e2', nodeType: 'EXPERIENCE' as const, label: 'e2' },
    { nodeId: 'p1', nodeType: 'PATTERN' as const, label: 'p1' },
    { nodeId: 'h1', nodeType: 'HYPOTHESIS' as const, label: 'h1' },
  ]

  it('retrieves the strongest connected knowledge while preserving contradictions', () => {
    let graph = { nodes, relations: [] as ReturnType<typeof addSharkKnowledgeRelation>['relations'] }
    graph = addSharkKnowledgeRelation(graph.nodes, graph.relations, { relationId: 'support', fromNodeId: 'e1', toNodeId: 'p1', relationType: 'SUPPORTS', weight: 0.9 })
    graph = addSharkKnowledgeRelation(graph.nodes, graph.relations, { relationId: 'contradiction', fromNodeId: 'e2', toNodeId: 'p1', relationType: 'CONTRADICTS', weight: 0.95 })
    graph = addSharkKnowledgeRelation(graph.nodes, graph.relations, { relationId: 'hypothesis', fromNodeId: 'p1', toNodeId: 'h1', relationType: 'DERIVED_FROM', weight: 0.8 })
    const result = retrieveRelevantSharkKnowledge({ startNodeId: 'e1', nodes: graph.nodes, relations: graph.relations, maxDepth: 2, minimumScore: 0.5 })
    expect(result.nodeIds).toContain('p1')
    expect(result.nodeIds).toContain('h1')
    expect(result.relationIds).toContain('support')
    expect(result.relationIds).toContain('hypothesis')
    expect(graph.relations.map(r => r.relationType)).toContain('CONTRADICTS')
  })

  it('does not mutate the underlying graph during retrieval', () => {
    const relations = [{ relationId: 'r1', fromNodeId: 'e1', toNodeId: 'p1', relationType: 'SUPPORTS' as const, weight: 0.9 }]
    const before = JSON.stringify(relations)
    retrieveRelevantSharkKnowledge({ startNodeId: 'e1', nodes, relations, maxDepth: 2, minimumScore: 0 })
    expect(JSON.stringify(relations)).toBe(before)
  })
})
