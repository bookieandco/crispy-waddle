import { createSharkReasoningContextAudit } from './reasoning-context-audit'

describe('SHARK 1.49-E reasoning-context assembly audit trail', () => {
  const handoff = {
    queryNodeId: 'q1', experienceIds: ['e1', 'e2', 'e3'], patterns: [], hypotheses: [], confidence: 0.8,
    evidenceBalance: 0.2, contradictionCount: 1, evidenceStrength: 0.7,
    eligibility: { eligible: true, reason: 'sufficient-evidence' as const, evidenceStrength: 0.7 },
    historicalEvidencePreserved: true as const,
  }

  it('records included and excluded evidence plus contradiction metadata', () => {
    const audit = createSharkReasoningContextAudit({ eventId: 'rca-1', handoff, excludedExperienceIds: ['e4'], contradictionQuota: 1, contradictionReserved: true, occurredAt: '2026-09-01T12:00:00Z' })
    expect(audit.includedExperienceIds).toEqual(['e1', 'e2', 'e3'])
    expect(audit.excludedExperienceIds).toEqual(['e4'])
    expect(audit.contradictionQuota).toBe(1)
    expect(audit.contradictionReserved).toBe(true)
  })

  it('preserves evidence balance and strength without rewriting history', () => {
    const audit = createSharkReasoningContextAudit({ eventId: 'rca-2', handoff, occurredAt: 't' })
    expect(audit.evidenceBalance).toBe(0.2)
    expect(audit.evidenceStrength).toBe(0.7)
    expect(audit.historicalEvidencePreserved).toBe(true)
  })

  it('creates an immutable snapshot and rejects invalid metadata', () => {
    const audit = createSharkReasoningContextAudit({ eventId: 'rca-3', handoff, occurredAt: 't' })
    expect(Object.isFrozen(audit)).toBe(true)
    expect(() => createSharkReasoningContextAudit({ eventId: '', handoff, occurredAt: 't' })).toThrow()
    expect(() => createSharkReasoningContextAudit({ eventId: 'x', handoff: { ...handoff, evidenceBalance: 2 }, occurredAt: 't' })).toThrow()
    expect(() => createSharkReasoningContextAudit({ eventId: 'x', handoff, contradictionQuota: -1, occurredAt: 't' })).toThrow()
  })
})
