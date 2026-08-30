import { synthesizeSharkContext } from './contextual-recall-synthesis'

describe('SHARK 1.44-C contextual recall synthesis', () => {
  const nodes = [
    { nodeId: 'p1', nodeType: 'PATTERN' as const, label: 'pattern' },
    { nodeId: 'h1', nodeType: 'HYPOTHESIS' as const, label: 'hypothesis' },
  ]

  it('creates a structured context package from ranked recall', () => {
    const result = synthesizeSharkContext({
      queryNodeId: 'e-current',
      ranked: [
        { experienceId: 'e1', score: 0.9, rank: 1 },
        { experienceId: 'e2', score: 0.7, rank: 2 },
      ],
      nodes,
      contradictionExperienceIds: ['e2'],
    })
    expect(result.queryNodeId).toBe('e-current')
    expect(result.rankedExperienceIds).toEqual(['e1', 'e2'])
    expect(result.sourceExperienceIds).toEqual(['e1', 'e2'])
    expect(result.confidence).toBeCloseTo(0.8)
    expect(result.contradictionCount).toBe(1)
  })

  it('does not invent patterns or hypotheses absent from recalled nodes', () => {
    const result = synthesizeSharkContext({ queryNodeId: 'e-current', ranked: [{ experienceId: 'e1', score: 0.9, rank: 1 }], nodes })
    expect(result.patterns).toEqual([])
    expect(result.hypotheses).toEqual([])
  })

  it('handles empty recall without manufacturing confidence', () => {
    const result = synthesizeSharkContext({ queryNodeId: 'e-current', ranked: [], nodes })
    expect(result.confidence).toBe(0)
    expect(result.sourceExperienceIds).toEqual([])
  })

  it('requires an identifiable query node', () => {
    expect(() => synthesizeSharkContext({ queryNodeId: ' ', ranked: [], nodes })).toThrow()
  })
})
