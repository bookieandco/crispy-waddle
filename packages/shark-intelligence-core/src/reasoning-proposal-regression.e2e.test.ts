import { createSharkReasoningProposal } from './reasoning-proposal'

describe('SHARK 1.45-E proposal validation regression', () => {
  const handoff = {
    queryNodeId: 'e-current', experienceIds: ['e-support', 'e-conflict'], patterns: ['p1'], hypotheses: ['h1'],
    confidence: 0.8, evidenceBalance: 0, contradictionCount: 1, evidenceStrength: 0.6,
    eligibility: { eligible: true, reason: 'sufficient-evidence' as const, evidenceStrength: 0.6 },
    historicalEvidencePreserved: true as const,
  }

  it('keeps proposals explicitly provisional', () => {
    const proposal = createSharkReasoningProposal({ proposalId: 'p-1', conclusion: 'Prefer hypothesis H1', handoff })
    expect(proposal.status).toBe('PROPOSED')
    expect(proposal.status).not.toBe('VALIDATED')
    expect(proposal.status).not.toBe('FACT')
  })

  it('carries historical evidence into the proposal without deleting contradictions', () => {
    const proposal = createSharkReasoningProposal({ proposalId: 'p-2', conclusion: 'Consider H1', handoff })
    expect(proposal.conflictingExperienceIds).toEqual(['e-support', 'e-conflict'])
    expect(proposal.historicalEvidencePreserved).toBe(true)
  })

  it('rejects empty proposals', () => {
    expect(() => createSharkReasoningProposal({ proposalId: '', conclusion: 'x', handoff })).toThrow()
    expect(() => createSharkReasoningProposal({ proposalId: 'p', conclusion: '', handoff })).toThrow()
  })
})
