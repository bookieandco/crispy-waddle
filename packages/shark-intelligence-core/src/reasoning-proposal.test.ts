import { createSharkReasoningProposal } from './reasoning-proposal'

describe('SHARK 1.45-D reasoning proposal boundary', () => {
  const handoff = {
    queryNodeId: 'e-current', experienceIds: ['e1', 'e2'], patterns: ['p1'], hypotheses: ['h1'],
    confidence: 0.8, evidenceBalance: 0.1, contradictionCount: 1, evidenceStrength: 0.55,
    eligibility: { eligible: true, reason: 'sufficient-evidence' as const, evidenceStrength: 0.55 },
    historicalEvidencePreserved: true as const,
  }

  it('creates a proposal without changing the handoff evidence', () => {
    const result = createSharkReasoningProposal({ proposalId: 'prop-1', conclusion: 'Prefer path A', handoff })
    expect(result.status).toBe('PROPOSED')
    expect(result.queryNodeId).toBe('e-current')
    expect(result.evidenceStrength).toBe(0.55)
    expect(result.historicalEvidencePreserved).toBe(true)
    expect(result.conflictingExperienceIds).toEqual(['e1', 'e2'])
  })

  it('keeps proposals distinct from facts', () => {
    const result = createSharkReasoningProposal({ proposalId: 'prop-2', conclusion: 'Hypothesis X', handoff })
    expect(result.status).not.toBe('VALIDATED')
    expect(result.status).not.toBe('FACT')
  })

  it('rejects empty proposal identity or conclusion', () => {
    expect(() => createSharkReasoningProposal({ proposalId: ' ', conclusion: 'x', handoff })).toThrow()
    expect(() => createSharkReasoningProposal({ proposalId: 'p', conclusion: ' ', handoff })).toThrow()
  })
})
