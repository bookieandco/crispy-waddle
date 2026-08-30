import { createSharkReasoningHandoff } from './knowledge-use-handoff'

describe('SHARK 1.45-C reasoning handoff boundary', () => {
  const context = {
    queryNodeId: 'e-current', experienceIds: ['e1', 'e2'], patterns: ['p1'], hypotheses: ['h1'],
    confidence: 0.8, evidenceBalance: 0.2, contradictionCount: 1, historicalEvidencePreserved: true as const,
  }

  it('creates an immutable reasoning input with provenance and eligibility', () => {
    const handoff = createSharkReasoningHandoff({
      context,
      eligibility: { eligible: true, reason: 'sufficient-evidence', evidenceStrength: 0.48 },
    })
    expect(handoff.queryNodeId).toBe('e-current')
    expect(handoff.experienceIds).toEqual(['e1', 'e2'])
    expect(handoff.contradictionCount).toBe(1)
    expect(handoff.historicalEvidencePreserved).toBe(true)
    expect(Object.isFrozen(handoff)).toBe(true)
    expect(Object.isFrozen(handoff.experienceIds)).toBe(true)
  })

  it('preserves rejected eligibility rather than bypassing the gate', () => {
    const handoff = createSharkReasoningHandoff({
      context,
      eligibility: { eligible: false, reason: 'unresolved-contradiction', evidenceStrength: 0.4 },
    })
    expect(handoff.eligibility.eligible).toBe(false)
    expect(handoff.eligibility.reason).toBe('unresolved-contradiction')
  })

  it('rejects an internally inconsistent eligible handoff', () => {
    expect(() => createSharkReasoningHandoff({
      context,
      eligibility: { eligible: true, reason: 'sufficient-evidence', evidenceStrength: 0 },
    })).toThrow()
  })
})
