import { synthesizeSharkLongitudinalBelief } from './longitudinal-belief-synthesis'

describe('SHARK 1.51-C weighted synthesis regression', () => {
  const history = {
    beliefId: 'b1',
    versions: [
      { beliefId: 'b1', version: 1, confidence: 0.4, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2'] },
      { beliefId: 'b1', version: 2, confidence: 0.8, updateId: 'u2', proposalId: 'p2', supportingExperienceIds: ['e1', 'e3'], conflictingExperienceIds: ['e2', 'e4'] },
    ],
  }

  it('preserves every historical experience reference', () => {
    const result = synthesizeSharkLongitudinalBelief({ history, newSupportingExperienceIds: ['e5'], newConflictingExperienceIds: ['e6'] })
    expect(result.supportingExperienceIds).toEqual(['e1', 'e3', 'e5'])
    expect(result.conflictingExperienceIds).toEqual(['e2', 'e4', 'e6'])
  })

  it('is invariant to repeated references', () => {
    const result = synthesizeSharkLongitudinalBelief({ history, newSupportingExperienceIds: ['e3', 'e3'], newConflictingExperienceIds: ['e4', 'e4'] })
    expect(result.supportCount).toBe(2)
    expect(result.conflictCount).toBe(2)
  })

  it('is deterministic for identical inputs', () => {
    const a = synthesizeSharkLongitudinalBelief({ history })
    const b = synthesizeSharkLongitudinalBelief({ history })
    expect(a).toEqual(b)
  })

  it('keeps confidence bounded and direction deterministic', () => {
    const result = synthesizeSharkLongitudinalBelief({ history })
    expect(result.currentConfidence).toBeGreaterThanOrEqual(0)
    expect(result.currentConfidence).toBeLessThanOrEqual(1)
    expect(result.direction).toBe('reinforced')
  })
})
