import { assessWithSharkKnowledge } from './knowledge-backed-assessment'

describe('SHARK 1.38 final assessment boundary', () => {
  const knowledge = [
    { knowledgeId: 'k-strong', strategyId: 's1', stage: 'usable_for_assessment' as const, scenarioTags: ['momentum'], confidence: 0.92, sampleSize: 1000, provenanceComplete: true, relevanceScore: 0.9, usable: true },
    { knowledgeId: 'k-supporting', strategyId: 's1', stage: 'usable_for_assessment' as const, scenarioTags: ['momentum'], confidence: 0.88, sampleSize: 800, provenanceComplete: true, relevanceScore: 0.82, usable: true },
    { knowledgeId: 'k-unvalidated', strategyId: 's1', stage: 'training' as const, scenarioTags: ['momentum'], confidence: 0.99, sampleSize: 5000, provenanceComplete: true, relevanceScore: 1, usable: false },
  ]

  it('uses only assessment-usable knowledge', () => {
    const result = assessWithSharkKnowledge({ assessmentId: 'a-final', opportunityId: 'o-final', strategyId: 's1', knowledge })
    expect(result.status).toBe('KNOWLEDGE_BACKED')
    expect(result.knowledgeIds).toEqual(['k-strong', 'k-supporting'])
    expect(result.knowledgeIds).not.toContain('k-unvalidated')
    expect(result.paperOnly).toBe(true)
    expect(result.simulated).toBe(true)
  })

  it('does not manufacture an assessment without usable knowledge', () => {
    const result = assessWithSharkKnowledge({ assessmentId: 'a-empty', opportunityId: 'o-final', strategyId: 's2', knowledge })
    expect(result.status).toBe('INSUFFICIENT_KNOWLEDGE')
    expect(result.confidence).toBe(0)
  })

  it('never turns assessment readiness into execution authority', () => {
    const result = assessWithSharkKnowledge({ assessmentId: 'a-boundary', opportunityId: 'o-final', strategyId: 's1', knowledge })
    expect(result.paperOnly).toBe(true)
    expect(result.simulated).toBe(true)
    expect((result as Record<string, unknown>).execute).toBeUndefined()
    expect((result as Record<string, unknown>).liveExecutionAuthorized).toBeUndefined()
  })
})
