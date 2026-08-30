import { recallSharkContext } from './contextual-knowledge-recall'

describe('SHARK 1.44-A contextual knowledge recall', () => {
  const nodes = [
    { nodeId: 'e1', nodeType: 'EXPERIENCE' as const, label: 'current situation' },
    { nodeId: 'p1', nodeType: 'PATTERN' as const, label: 'historical pattern' },
    { nodeId: 'h1', nodeType: 'HYPOTHESIS' as const, label: 'causal hypothesis' },
    { nodeId: 'e2', nodeType: 'EXPERIENCE' as const, label: 'distant history' },
  ]
  const relations = [
    { relationId: 'r1', fromNodeId: 'e1', toNodeId: 'p1', relationType: 'SIMILAR_TO' as const, weight: 0.9 },
    { relationId: 'r2', fromNodeId: 'p1', toNodeId: 'h1', relationType: 'DERIVED_FROM' as const, weight: 0.8 },
    { relationId: 'r3', fromNodeId: 'h1', toNodeId: 'e2', relationType: 'CONTRADICTS' as const, weight: 0.2 },
  ]

  it('assembles relevant historical context from a query situation', () => {
    const result = recallSharkContext({ queryNodeId: 'e1', nodes, relations, maxDepth: 2, minimumScore: 0.5 })
    expect(result.queryNodeId).toBe('e1')
    expect(result.relevantNodeIds).toEqual(['e1', 'p1', 'h1'])
    expect(result.relevantRelationIds).toEqual(['r1', 'r2'])
    expect(result.relevanceScores.h1).toBeCloseTo(0.72)
  })

  it('filters weak historical context rather than presenting it as equally relevant', () => {
    const result = recallSharkContext({ queryNodeId: 'e1', nodes, relations, maxDepth: 3, minimumScore: 0.5 })
    expect(result.relevantNodeIds).not.toContain('e2')
    expect(result.relevanceScores.e2).toBeUndefined()
  })

  it('retains the retrieval boundary so callers can audit why context was selected', () => {
    const result = recallSharkContext({ queryNodeId: 'e1', nodes, relations, maxDepth: 2, minimumScore: 0.4 })
    expect(result.maxDepth).toBe(2)
    expect(result.minimumScore).toBe(0.4)
  })
})
