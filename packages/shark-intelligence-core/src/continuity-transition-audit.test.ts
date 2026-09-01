import { createSharkContinuityTransitionAudit } from './continuity-transition-audit'

describe('SHARK 1.50-E continuity transition audit trail', () => {
  const previous = {
    contextId: 'c1', version: 1,
    experienceIds: ['e1', 'e2'],
    beliefVersionIds: ['b1'],
    unresolvedContradictionIds: ['x1'],
  }
  const next = {
    contextId: 'c2', version: 2,
    experienceIds: ['e2', 'e3'],
    beliefVersionIds: ['b1', 'b2'],
    unresolvedContradictionIds: ['x1', 'x2'],
  }

  it('records additions and retained historical references', () => {
    const audit = createSharkContinuityTransitionAudit({ eventId: 'cta-1', previous, next, occurredAt: '2026-09-01T12:00:00Z' })
    expect(audit.fromContextId).toBe('c1')
    expect(audit.toContextId).toBe('c2')
    expect(audit.addedExperienceIds).toEqual(['e3'])
    expect(audit.retainedExperienceIds).toEqual(['e2'])
    expect(audit.addedBeliefVersionIds).toEqual(['b2'])
    expect(audit.retainedBeliefVersionIds).toEqual(['b1'])
    expect(audit.addedContradictionIds).toEqual(['x2'])
    expect(audit.retainedContradictionIds).toEqual(['x1'])
  })

  it('audits the initial transition from no prior context', () => {
    const audit = createSharkContinuityTransitionAudit({ eventId: 'cta-2', previous: null, next, occurredAt: 't' })
    expect(audit.fromVersion).toBe(0)
    expect(audit.addedExperienceIds).toEqual(['e2', 'e3'])
  })

  it('rejects non-advancing versions and invalid identity', () => {
    expect(() => createSharkContinuityTransitionAudit({ eventId: '', previous, next, occurredAt: 't' })).toThrow()
    expect(() => createSharkContinuityTransitionAudit({ eventId: 'x', previous, next: { ...next, version: 1 }, occurredAt: 't' })).toThrow()
  })

  it('returns an immutable audit snapshot', () => {
    const audit = createSharkContinuityTransitionAudit({ eventId: 'cta-3', previous, next, occurredAt: 't' })
    expect(Object.isFrozen(audit)).toBe(true)
    expect(Object.isFrozen(audit.addedContradictionIds)).toBe(true)
  })
})
