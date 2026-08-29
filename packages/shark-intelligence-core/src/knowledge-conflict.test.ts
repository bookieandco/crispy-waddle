import { detectSharkKnowledgeConflict } from './knowledge-conflict'

describe('detectSharkKnowledgeConflict', () => {
  const record = (id: string, confidence: number) => ({
    knowledgeId: id, strategyId: 's1', stage: 'usable_for_assessment' as const,
    scenarioTags: ['momentum'], confidence, sampleSize: 100,
    provenanceComplete: true, relevanceScore: 0.8, usable: true,
  })

  it('detects confidence disagreement', () => {
    const result = detectSharkKnowledgeConflict({ knowledge: [record('k1', 0.95), record('k2', 0.5)] })
    expect(result.status).toBe('CONFLICT_DETECTED')
    expect(result.disagreement).toBe(true)
  })

  it('accepts consistent knowledge', () => {
    const result = detectSharkKnowledgeConflict({ knowledge: [record('k1', 0.8), record('k2', 0.85)] })
    expect(result.status).toBe('CONSISTENT')
    expect(result.disagreement).toBe(false)
  })
})
