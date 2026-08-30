import { retrieveRelevantSharkKnowledge } from './knowledge-graph-retrieval'

describe('SHARK 1.43-D relevance-weighted retrieval', () => {
  const nodes = [
    { nodeId: 'e1', nodeType: 'EXPERIENCE' as const, label: 'e1' },
    { nodeId: 'p1', nodeType: 'PATTERN' as const, label: 'p1' },
    { nodeId: 'p2', nodeType: 'PATTERN' as const, label: 'p2' },
    { nodeId: 'h1', nodeType: 'HYPOTHESIS' as const, label: 'h1' },
  ]
  const relations = [
    { relationId: 'strong', fromNodeId: 'e1', toNodeId: 'p1', relationType: 'SUPPORTS' as const, weight: 0.9 },
    { relationId: 'weak', fromNodeId: 'e1', toNodeId: 'p2', relationType: 'SIMILAR_TO' as const, weight: 0.2 },
    { relationId: 'next', fromNodeId: 'p1', toNodeId: 'h1', relationType: 'DERIVED_FROM' as const, weight: 0.8 },
  ]

  it('prioritizes stronger relationships', () => {
    const result = retrieveRelevantSharkKnowledge({ startNodeId: 'e1', nodes, relations, maxDepth: 1, minimumScore: 0.5 })
    expect(result.nodeIds).toContain('p1')
    expect(result.nodeIds).not.toContain('p2')
    expect(result.scores.p1).toBe(0.9)
  })

  it('propagates relevance through multiple hops', () => {
    const result = retrieveRelevantSharkKnowledge({ startNodeId: 'e1', nodes, relations, maxDepth: 2, minimumScore: 0.5 })
    expect(result.nodeIds).toContain('h1')
    expect(result.scores.h1).toBeCloseTo(0.72)
  })

  it('rejects invalid retrieval parameters', () => {
    expect(() => retrieveRelevantSharkKnowledge({ startNodeId: 'missing', nodes, relations })).toThrow()
    expect(() => retrieveRelevantSharkKnowledge({ startNodeId: 'e1', nodes, relations, minimumScore: 2 })).toThrow()
  })
})
