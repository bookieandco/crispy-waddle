import { prepareSharkKnowledgeForReasoning } from './knowledge-use-preparation'

describe('SHARK 1.45-A knowledge-use preparation', () => {
  it('packages recalled history without replacing its evidence', () => {
    const result = prepareSharkKnowledgeForReasoning({
      context: {
        queryNodeId: 'e-current', rankedExperienceIds: ['e1'], patterns: ['p1'], hypotheses: ['h1'],
        confidence: 0.8, contradictionCount: 1, sourceExperienceIds: ['e1'],
      },
      evidence: {
        supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2'],
        supportingScores: { e1: 0.7 }, conflictingScores: { e2: 0.6 }, balance: 0.08,
      },
    })
    expect(result.experienceIds).toEqual(['e1', 'e2'])
    expect(result.patterns).toEqual(['p1'])
    expect(result.hypotheses).toEqual(['h1'])
    expect(result.evidenceBalance).toBe(0.08)
    expect(result.historicalEvidencePreserved).toBe(true)
  })

  it('deduplicates repeated source IDs while retaining conflicting IDs', () => {
    const result = prepareSharkKnowledgeForReasoning({
      context: { queryNodeId: 'e', rankedExperienceIds: ['e1', 'e1'], patterns: [], hypotheses: [], confidence: 0.5, contradictionCount: 0, sourceExperienceIds: ['e1'] },
      evidence: { supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2'], supportingScores: {}, conflictingScores: {}, balance: 0 },
    })
    expect(result.experienceIds).toEqual(['e1', 'e2'])
  })

  it('rejects malformed query identity', () => {
    expect(() => prepareSharkKnowledgeForReasoning({
      context: { queryNodeId: ' e ', rankedExperienceIds: [], patterns: [], hypotheses: [], confidence: 0, contradictionCount: 0, sourceExperienceIds: [] },
      evidence: { supportingExperienceIds: [], conflictingExperienceIds: [], supportingScores: {}, conflictingScores: {}, balance: 0 },
    })).toThrow()
  })
})
