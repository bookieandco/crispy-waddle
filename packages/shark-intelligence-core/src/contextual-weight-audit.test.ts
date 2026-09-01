import { createSharkContextualWeightAudit } from './contextual-weight-audit'

describe('SHARK 1.48-E contextual-weight audit trail', () => {
  const input = { eventId: 'cwa-1', knowledgeKey: 'experience:e1', contextualWeight: 0.35, baseWeight: 0.8, contextSimilarity: 0.5, effectiveness: 0.9, beliefRelevance: 0.8, evidenceQuality: 1, occurredAt: '2026-09-01T12:00:00Z' }

  it('records the signals that produced contextual priority', () => {
    const audit = createSharkContextualWeightAudit(input)
    expect(audit.knowledgeKey).toBe('experience:e1')
    expect(audit.contextualWeight).toBe(0.35)
    expect(audit.contextSimilarity).toBe(0.5)
    expect(audit.effectiveness).toBe(0.9)
  })

  it('keeps contextual weighting separate from truth/evidence quality', () => {
    const audit = createSharkContextualWeightAudit({ ...input, contextSimilarity: 0.1, evidenceQuality: 1 })
    expect(audit.contextSimilarity).toBe(0.1)
    expect(audit.evidenceQuality).toBe(1)
  })

  it('creates an immutable snapshot and rejects invalid signals', () => {
    const audit = createSharkContextualWeightAudit(input)
    expect(Object.isFrozen(audit)).toBe(true)
    expect(() => createSharkContextualWeightAudit({ ...input, eventId: '' })).toThrow()
    expect(() => createSharkContextualWeightAudit({ ...input, contextualWeight: 1.1 })).toThrow()
  })
})
