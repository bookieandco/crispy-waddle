import { applyValidatedSharkBeliefUpdate } from './belief-update'
import { createSharkBeliefUpdateAuditEvent } from './belief-update-audit'

describe('SHARK 1.46-E belief update audit trail', () => {
  it('records the validated transition and its evidence', () => {
    const update = applyValidatedSharkBeliefUpdate({
      updateId: 'u1', beliefId: 'b1', previousConfidence: 0.4, newConfidence: 0.75,
      proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2'], validated: true,
    })
    const event = createSharkBeliefUpdateAuditEvent({ eventId: 'audit-1', occurredAt: '2026-08-30T12:00:00Z', update })
    expect(event.eventType).toBe('BELIEF_UPDATED')
    expect(event.beliefId).toBe('b1')
    expect(event.previousConfidence).toBe(0.4)
    expect(event.newConfidence).toBe(0.75)
    expect(event.proposalId).toBe('p1')
    expect(event.supportingExperienceIds).toEqual(['e1'])
    expect(event.conflictingExperienceIds).toEqual(['e2'])
    expect(event.validation.validated).toBe(true)
  })

  it('does not create an audit event for an unvalidated update', () => {
    const update = { updateId: 'u1', beliefId: 'b1', previousConfidence: 0.4, newConfidence: 0.75, proposalId: 'p1', supportingExperienceIds: [], conflictingExperienceIds: [], validated: false as true }
    expect(() => createSharkBeliefUpdateAuditEvent({ eventId: 'audit-1', occurredAt: '2026-08-30T12:00:00Z', update })).toThrow()
  })

  it('preserves evidence references in an immutable audit snapshot', () => {
    const update = applyValidatedSharkBeliefUpdate({
      updateId: 'u2', beliefId: 'b1', previousConfidence: 0.8, newConfidence: 0.3,
      proposalId: 'p2', supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2', 'e3'], validated: true,
    })
    const event = createSharkBeliefUpdateAuditEvent({ eventId: 'audit-2', occurredAt: '2026-08-30T12:01:00Z', update })
    expect(Object.isFrozen(event)).toBe(true)
    expect(Object.isFrozen(event.supportingExperienceIds)).toBe(true)
    expect(Object.isFrozen(event.conflictingExperienceIds)).toBe(true)
  })
})
