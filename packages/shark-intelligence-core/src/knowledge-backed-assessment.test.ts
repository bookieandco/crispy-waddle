import { assessWithSharkKnowledge } from './knowledge-backed-assessment'

describe('assessWithSharkKnowledge', () => {
  const knowledge = [{
    knowledgeId: 'k1', strategyId: 's1', stage: 'usable_for_assessment' as const,
    scenarioTags: ['momentum'], confidence: 0.9, sampleSize: 500,
    provenanceComplete: true, relevanceScore: 0.8, usable: true,
  }]

  it('uses validated knowledge for a matching strategy', () => {
    const result = assessWithSharkKnowledge({ assessmentId: 'a1', opportunityId: 'o1', strategyId: 's1', knowledge })
    expect(result.status).toBe('KNOWLEDGE_BACKED')
    expect(result.knowledgeIds).toEqual(['k1'])
    expect(result.paperOnly).toBe(true)
    expect(result.simulated).toBe(true)
  })

  it('fails closed when no usable knowledge exists', () => {
    const result = assessWithSharkKnowledge({ assessmentId: 'a2', opportunityId: 'o1', strategyId: 's2', knowledge })
    expect(result.status).toBe('INSUFFICIENT_KNOWLEDGE')
    expect(result.knowledgeIds).toEqual([])
  })

  it('surfaces high uncertainty instead of overstating confidence', () => {
    const result = assessWithSharkKnowledge({ assessmentId: 'a3', opportunityId: 'o1', strategyId: 's1', knowledge, uncertainty: 0.8 })
    expect(result.status).toBe('ASSESSMENT_WITH_UNCERTAINTY')
  })
})
