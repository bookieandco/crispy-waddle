import { traverseSharkKnowledgeGraph } from './knowledge-graph-traversal'

describe('SHARK 1.43-C bounded knowledge graph traversal', () => {
  const nodes = [
    { nodeId: 'e1', nodeType: 'EXPERIENCE' as const, label: 'e1' },
    { nodeId: 'p1', nodeType: 'PATTERN' as const, label: 'p1' },
    { nodeId: 'h1', nodeType: 'HYPOTHESIS' as const, label: 'h1' },
    { nodeId: 'e2', nodeType: 'EXPERIENCE' as const, label: 'e2' },
  ]
  const relations = [
    { relationId: 'r1', fromNodeId: 'e1', toNodeId: 'p1', relationType: 'DERIVED_FROM' as const, weight: 0.9 },
    { relationId: 'r2', fromNodeId: 'p1', toNodeId: 'h1', relationType: 'SUPPORTS' as const, weight: 0.8 },
    { relationId: 'r3', fromNodeId: 'h1', toNodeId: 'e2', relationType: 'CONTRADICTS' as const, weight: 0.7 },
  ]

  it('retrieves connected history within a bounded depth', () => {
    const result = traverseSharkKnowledgeGraph({ startNodeId: 'e1', nodes, relations, maxDepth: 2 })
    expect(result.nodeIds).toEqual(['e1', 'p1', 'h1'])
    expect(result.relationIds).toEqual(['r1', 'r2'])
  })

  it('does not traverse beyond the requested depth', () => {
    const result = traverseSharkKnowledgeGraph({ startNodeId: 'e1', nodes, relations, maxDepth: 1 })
    expect(result.nodeIds).toEqual(['e1', 'p1'])
    expect(result.nodeIds).not.toContain('h1')
  })

  it('rejects unknown start nodes and invalid depth', () => {
    expect(() => traverseSharkKnowledgeGraph({ startNodeId: 'missing', nodes, relations })).toThrow()
    expect(() => traverseSharkKnowledgeGraph({ startNodeId: 'e1', nodes, relations, maxDepth: -1 })).toThrow()
  })
})
