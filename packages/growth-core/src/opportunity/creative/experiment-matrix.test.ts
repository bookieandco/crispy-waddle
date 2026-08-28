import { describe, expect, it } from 'vitest'
import { buildExperimentMatrix } from './experiment-matrix.js'

describe('Experiment Matrix', () => {
  it('creates stable, individually addressable combinations', () => {
    const dna = {
      id: 'dna-1', opportunityId: 'opp-1', audience: 'buyers', pain: 'pain', discovery: 'discovery', demonstration: 'demo', benefit: 'benefit',
      hooks: [{ text: 'h1' }, { text: 'h2' }], bodies: [{ structure: 'b1' }, { structure: 'b2' }],
      ctas: [{ text: 'c1', action: 'click' as const }, { text: 'c2', action: 'buy' as const }], sourceEvidenceIds: [], createdAt: '', updatedAt: '',
    }
    const matrix = buildExperimentMatrix(dna)
    expect(matrix.variants).toHaveLength(8)
    expect(matrix.variants.map(v => v.id)).toEqual(['dna-1:1','dna-1:2','dna-1:3','dna-1:4','dna-1:5','dna-1:6','dna-1:7','dna-1:8'])
    expect(matrix.variants.every(v => v.status === 'draft')).toBe(true)
    expect(matrix.requiresApproval).toBe(true)
  })
})
