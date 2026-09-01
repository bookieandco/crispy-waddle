import { synthesizeSharkLongitudinalBelief } from './longitudinal-belief-synthesis'

describe('SHARK 1.51-A longitudinal belief synthesis', () => {
  const history = {
    beliefId: 'b1',
    versions: [
      { beliefId: 'b1', version: 1, confidence: 0.4, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2'] },
      { beliefId: 'b1', version: 2, confidence: 0.8, updateId: 'u2', proposalId: 'p2', supportingExperienceIds: ['e3'], conflictingExperienceIds: ['e4'] },
    ],
  }

  it('uses the current version while retaining the historical comparison', () => {
    const result = synthesizeSharkLongitudinalBelief({ history })
    expect(result.currentVersion).toBe(2)
    expect(result.currentConfidence).toBe(0.8)
    expect(result.historicalAverageConfidence).toBe(0.6)
    expect(result.direction).toBe('reinforced')
  })

  it('weighs accumulated support and conflict without deleting either side', () => {
    const result = synthesizeSharkLongitudinalBelief({ history, newSupportingExperienceIds: ['e5'], newConflictingExperienceIds: ['e6'] })
    expect(result.supportingExperienceIds).toEqual(['e3', 'e5'])
    expect(result.conflictingExperienceIds).toEqual(['e4', 'e6'])
    expect(result.netEvidence).toBe(0)
  })

  it('deduplicates new evidence references', () => {
    const result = synthesizeSharkLongitudinalBelief({ history, newSupportingExperienceIds: ['e3', 'e3'], newConflictingExperienceIds: ['e4', 'e4'] })
    expect(result.supportCount).toBe(1)
    expect(result.conflictCount).toBe(1)
  })

  it('does not mutate belief history or rewrite its versions', () => {
    const before = JSON.stringify(history)
    synthesizeSharkLongitudinalBelief({ history, newSupportingExperienceIds: ['e5'] })
    expect(JSON.stringify(history)).toBe(before)
  })

  it('rejects empty history and invalid thresholds', () => {
    expect(() => synthesizeSharkLongitudinalBelief({ history: { beliefId: 'b1', versions: [] } })).toThrow()
    expect(() => synthesizeSharkLongitudinalBelief({ history, stabilityThreshold: 2 })).toThrow()
  })
})
