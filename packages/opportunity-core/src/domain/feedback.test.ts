import { describe, expect, it } from 'vitest'
import { createFeedbackEvent, createVersionedAssessment, isLearningSignal } from './feedback.js'

describe('OCE-6.76 intelligence feedback', () => {
  it('creates stable append-only feedback event ids', () => {
    const event = createFeedbackEvent({ kind: 'OUTCOME', type: 'OPPORTUNITY_LOST', opportunityId: 'opp-1', sourceEvidenceIds: [], payload: {}, observedAt: '2026-08-30T12:00:00Z', recordedAt: '2026-08-30T12:01:00Z', schemaVersion: '1.0' })
    expect(event.id).toBe('OPPORTUNITY_LOST:opp-1::2026-08-30T12:00:00Z')
  })

  it('keeps source evidence references separate from outcomes', () => {
    const event = createFeedbackEvent({ kind: 'OUTCOME', type: 'OPPORTUNITY_WON', opportunityId: 'opp-1', sourceEvidenceIds: ['ev-1'], payload: { awardId: 'award-1' }, observedAt: '2026-08-30T12:00:00Z', recordedAt: '2026-08-30T12:01:00Z', schemaVersion: '1.0' })
    expect(event.kind).toBe('OUTCOME')
    expect(event.sourceEvidenceIds).toEqual(['ev-1'])
  })

  it('versions assessments instead of mutating historical scores', () => {
    const first = createVersionedAssessment({ subjectId: 'opp-1', assessmentType: 'ranking', score: 87, basisEvidenceIds: ['ev-1'], assessedAt: '2026-08-30T12:00:00Z', engineVersion: '6.73.0' })
    const second = createVersionedAssessment({ subjectId: 'opp-1', assessmentType: 'ranking', score: 62, basisEvidenceIds: ['ev-1', 'ev-2'], supersedesId: first.id, assessedAt: '2026-08-31T12:00:00Z', engineVersion: '6.76.0' })
    expect(second.supersedesId).toBe(first.id)
    expect(first.score).toBe(87)
  })

  it('distinguishes learning signals from observations and outcomes', () => {
    expect(isLearningSignal({ kind: 'LEARNING_SIGNAL' })).toBe(true)
    expect(isLearningSignal({ kind: 'OUTCOME' })).toBe(false)
  })
})
