import { reconcileSharkBeliefHistory } from './belief-reconciliation'

describe('SHARK 1.46-C belief reconciliation', () => {
  const history = {
    beliefId: 'b1',
    versions: [
      { beliefId: 'b1', version: 1, confidence: 0.4, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: [] },
      { beliefId: 'b1', version: 2, confidence: 0.8, updateId: 'u2', proposalId: 'p2', supportingExperienceIds: ['e2'], conflictingExperienceIds: ['e3'] },
    ],
  }

  it('compares current confidence with the historical average', () => {
    const result = reconcileSharkBeliefHistory({ history })
    expect(result.currentConfidence).toBe(0.8)
    expect(result.historicalAverageConfidence).toBe(0.6)
    expect(result.direction).toBe('reinforced')
  })

  it('can identify weakening and stability', () => {
    const weakened = reconcileSharkBeliefHistory({ history: { ...history, versions: [...history.versions, { ...history.versions[1], version: 3, confidence: 0.2, updateId: 'u3', proposalId: 'p3' }] } })
    expect(weakened.direction).toBe('weakened')
    const stable = reconcileSharkBeliefHistory({ history, stabilityThreshold: 0.3 })
    expect(stable.direction).toBe('stable')
  })

  it('preserves and extends supporting and conflicting evidence references', () => {
    const result = reconcileSharkBeliefHistory({ history, newSupportingExperienceIds: ['e4', 'e4'], newConflictingExperienceIds: ['e5', 'e5'] })
    expect(result.supportingExperienceIds).toEqual(['e2', 'e4'])
    expect(result.conflictingExperienceIds).toEqual(['e3', 'e5'])
  })

  it('rejects empty history and invalid thresholds', () => {
    expect(() => reconcileSharkBeliefHistory({ history: { beliefId: 'b', versions: [] } })).toThrow()
    expect(() => reconcileSharkBeliefHistory({ history, stabilityThreshold: 2 })).toThrow()
  })
})
