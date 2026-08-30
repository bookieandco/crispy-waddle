import { createSharkKnowledgeWeightAudit } from './knowledge-weight-audit'

describe('SHARK 1.47-E knowledge-weight audit trail', () => {
  it('records why a weighting changed', () => {
    const event = createSharkKnowledgeWeightAudit({
      eventId: 'wa-1', knowledgeKey: 'experience:e1', previousWeight: 0.5, nextWeight: 0.56,
      effectivenessDelta: 0.6, sampleCount: 1, occurredAt: '2026-08-30T12:00:00Z',
    })
    expect(event.reason).toBe('positive-effectiveness')
    expect(event.previousWeight).toBe(0.5)
    expect(event.nextWeight).toBe(0.56)
  })

  it('records negative and neutral feedback without rewriting history', () => {
    expect(createSharkKnowledgeWeightAudit({ eventId: 'wa-2', knowledgeKey: 'e2', previousWeight: 0.6, nextWeight: 0.55, effectivenessDelta: -0.5, sampleCount: 2, occurredAt: 't' }).reason).toBe('negative-effectiveness')
    expect(createSharkKnowledgeWeightAudit({ eventId: 'wa-3', knowledgeKey: 'e3', previousWeight: 0.6, nextWeight: 0.6, effectivenessDelta: 0, sampleCount: 3, occurredAt: 't' }).reason).toBe('neutral-effectiveness')
  })

  it('creates an immutable audit snapshot and validates bounds', () => {
    const event = createSharkKnowledgeWeightAudit({ eventId: 'wa-4', knowledgeKey: 'e4', previousWeight: 0, nextWeight: 1, effectivenessDelta: 1, sampleCount: 10, occurredAt: 't' })
    expect(Object.isFrozen(event)).toBe(true)
    expect(() => createSharkKnowledgeWeightAudit({ eventId: '', knowledgeKey: 'e', previousWeight: 0.5, nextWeight: 0.5, effectivenessDelta: 0, sampleCount: 1, occurredAt: 't' })).toThrow()
    expect(() => createSharkKnowledgeWeightAudit({ eventId: 'x', knowledgeKey: 'e', previousWeight: 1.2, nextWeight: 0.5, effectivenessDelta: 0, sampleCount: 1, occurredAt: 't' })).toThrow()
  })
})
