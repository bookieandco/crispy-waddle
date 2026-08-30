import { addSharkKnowledgeRelation, type SharkKnowledgeNode } from './knowledge-graph'

describe('SHARK 1.43-B knowledge graph integrity', () => {
  const nodes: SharkKnowledgeNode[] = [
    { nodeId: 'e1', nodeType: 'EXPERIENCE', label: 'experience 1' },
    { nodeId: 'p1', nodeType: 'PATTERN', label: 'pattern 1' },
  ]

  const relation = { relationId: 'r1', fromNodeId: 'e1', toNodeId: 'p1', relationType: 'SUPPORTS' as const, weight: 0.5 }

  it('accepts valid relationships', () => {
    const result = addSharkKnowledgeRelation(nodes, [], relation)
    expect(result.relations).toHaveLength(1)
  })

  it('rejects dangling endpoints', () => {
    expect(() => addSharkKnowledgeRelation(nodes, [], { ...relation, toNodeId: 'missing' })).toThrow()
  })

  it('rejects duplicate relation IDs', () => {
    expect(() => addSharkKnowledgeRelation(nodes, [relation], relation)).toThrow()
  })

  it('enforces relation weight bounds', () => {
    expect(() => addSharkKnowledgeRelation(nodes, [], { ...relation, weight: -0.1 })).toThrow()
    expect(() => addSharkKnowledgeRelation(nodes, [], { ...relation, weight: 1.1 })).toThrow()
    expect(() => addSharkKnowledgeRelation(nodes, [], { ...relation, weight: Number.NaN })).toThrow()
  })

  it('preserves contradictory evidence as a separate edge', () => {
    const contradiction = { ...relation, relationId: 'r2', relationType: 'CONTRADICTS' as const, weight: 0.8 }
    const result = addSharkKnowledgeRelation(nodes, [relation], contradiction)
    expect(result.relations.map(r => r.relationType)).toEqual(['SUPPORTS', 'CONTRADICTS'])
    expect(result.nodes).toEqual(nodes)
  })
})
