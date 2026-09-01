import { appendSharkBeliefVersion } from './belief-history'
import { reconcileSharkLongitudinalBelief } from './longitudinal-belief-reconciliation'
import { createSharkBeliefReconciliationAudit } from './belief-reconciliation-audit'

describe('SHARK 1.51-E belief reconciliation audit trail', () => {
  it('records the exact historical versions and evidence used by reconciliation', () => {
    const first = appendSharkBeliefVersion({ history: { beliefId: 'b1', versions: [] }, confidence: 0.4, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2'] })
    const history = appendSharkBeliefVersion({ history: first, confidence: 0.8, updateId: 'u2', proposalId: 'p2', supportingExperienceIds: ['e3'], conflictingExperienceIds: ['e4'] })
    const reconciliation = reconcileSharkLongitudinalBelief({ history, supportingEvidence: [{ experienceId: 'e5', weight: 0.9 }], conflictingEvidence: [{ experienceId: 'e6', weight: 0.3 }] })
    const audit = createSharkBeliefReconciliationAudit({ auditId: 'audit-1', reconciliation, occurredAt: '2026-09-01T12:00:00Z' })
    expect(audit.historicalVersionIds).toEqual(['b1:v1', 'b1:v2'])
    expect(audit.supportingExperienceIds).toEqual(['e1', 'e3', 'e5'])
    expect(audit.conflictingExperienceIds).toEqual(['e2', 'e4', 'e6'])
    expect(audit.supportWeight).toBe(0.9)
    expect(audit.conflictWeight).toBe(0.3)
    expect(audit.netEvidence).toBe(0.6000000000000001)
  })

  it('preserves the reconciliation assessment in an immutable snapshot', () => {
    const history = appendSharkBeliefVersion({ history: { beliefId: 'b2', versions: [] }, confidence: 0.6, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: [], conflictingExperienceIds: [] })
    const reconciliation = reconcileSharkLongitudinalBelief({ history, supportingEvidence: [{ experienceId: 'e1', weight: 1 }] })
    const audit = createSharkBeliefReconciliationAudit({ auditId: 'audit-2', reconciliation, occurredAt: 't' })
    expect(audit.currentConfidence).toBe(0.6)
    expect(audit.direction).toBe('stable')
    expect(Object.isFrozen(audit)).toBe(true)
    expect(Object.isFrozen(audit.historicalVersionIds)).toBe(true)
  })

  it('rejects invalid audit identity and confidence metadata', () => {
    const history = appendSharkBeliefVersion({ history: { beliefId: 'b3', versions: [] }, confidence: 0.5, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: [], conflictingExperienceIds: [] })
    const reconciliation = reconcileSharkLongitudinalBelief({ history })
    expect(() => createSharkBeliefReconciliationAudit({ auditId: '', reconciliation, occurredAt: 't' })).toThrow()
    expect(() => createSharkBeliefReconciliationAudit({ auditId: 'a', reconciliation: { ...reconciliation, currentConfidence: 2 }, occurredAt: 't' })).toThrow()
  })
})
