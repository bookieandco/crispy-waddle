import { evaluateSharkKnowledgeEligibility } from './knowledge-use-eligibility'

describe('SHARK 1.45-B knowledge-use eligibility', () => {
  const base = {
    queryNodeId: 'e-current', experienceIds: ['e1'], patterns: [], hypotheses: [], confidence: 0.9,
    evidenceBalance: 0.8, contradictionCount: 0, historicalEvidencePreserved: true as const,
  }

  it('allows sufficiently supported knowledge', () => {
    const result = evaluateSharkKnowledgeEligibility({ context: base })
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('sufficient-evidence')
  })

  it('rejects insufficient evidence', () => {
    const result = evaluateSharkKnowledgeEligibility({ context: { ...base, confidence: 0.1 }, minimumEvidenceStrength: 0.5 })
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('insufficient-evidence')
  })

  it('blocks unresolved contradictions by default', () => {
    const result = evaluateSharkKnowledgeEligibility({ context: { ...base, contradictionCount: 2 } })
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('unresolved-contradiction')
  })

  it('can explicitly allow unresolved contradictions for downstream dialectical reasoning', () => {
    const result = evaluateSharkKnowledgeEligibility({ context: { ...base, contradictionCount: 2 }, allowUnresolvedContradictions: true })
    expect(result.eligible).toBe(true)
  })

  it('rejects invalid thresholds and empty evidence', () => {
    expect(() => evaluateSharkKnowledgeEligibility({ context: base, minimumEvidenceStrength: 2 })).toThrow()
    expect(evaluateSharkKnowledgeEligibility({ context: { ...base, experienceIds: [] } }).eligible).toBe(false)
  })
})
