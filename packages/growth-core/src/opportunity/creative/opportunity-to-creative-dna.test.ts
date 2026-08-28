import { describe, expect, it } from 'vitest'
import { opportunityToCreativeBrief } from './opportunity-to-creative-dna.js'

describe('opportunityToCreativeBrief', () => {
  it('maps a sales opportunity to a demand-generation brief without using an LLM', () => {
    const result = opportunityToCreativeBrief({
      id: 'opp-1', strategy: 'affiliate', description: 'People need a better workflow', title: 'Workflow product', targetAudience: 'small businesses', problem: 'Manual follow-up', valueProposition: 'Recover missed leads', evidence: [{ id: 'e1' }], score: { evidenceConfidence: .8 },
    } as any)
    expect(result.objective).toBe('drive_sales')
    expect(result.audience).toBe('small businesses')
    expect(result.pain).toBe('Manual follow-up')
    expect(result.benefit).toBe('Recover missed leads')
    expect(result.sourceEvidenceIds).toEqual(['e1'])
    expect(result.evidenceQuality).toBe(.8)
  })
})
