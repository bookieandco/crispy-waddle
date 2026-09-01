import { appendSharkBeliefVersion } from './belief-history'
import { reconcileSharkLongitudinalBelief } from './longitudinal-belief-reconciliation'

describe('SHARK 1.51-D longitudinal belief reconciliation', () => {
  const history = appendSharkBeliefVersion({
    history: { beliefId: 'b1', versions: [] }, confidence: 0.4, updateId: 'u1', proposalId: 'p1',
    supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2'],
  })
  const current = appendSharkBeliefVersion({
    history, confidence: 0.8, updateId: 'u2', proposalId: 'p2',
    supportingExperienceIds: ['e3'], conflictingExperienceIds: ['e4'],
  })

  it('reconciles current belief against its complete version history', () => {
    const result = reconcileSharkLongitudinalBelief({
      history: current,
      supportingEvidence: [{ experienceId: 'e5', weight: 0.9 }, { experienceId: 'e6', weight: 0.2 }],
      conflictingEvidence: [{ experienceId: 'e7', weight: 0.4 }],
    })
    expect(result.selectedVersion).toBe(2)
    expect(result.currentConfidence).toBe(0.8)
    expect(result.historicalAverageConfidence).toBe(0.6000000000000001)
    expect(result.supportWeight).toBe(1.1)
    expect(result.conflictWeight).toBe(0.4)
    expect(result.netEvidence).toBeCloseTo(0.7)
    expect(result.evidenceBalance).toBeCloseTo(0.63636, 4)
  })

  it('retains supporting and conflicting history while adding weighted evidence', () => {
    const result = reconcileSharkLongitudinalBelief({
      history: current,
      supportingEvidence: [{ experienceId: 'e1', weight: 0.1 }],
      conflictingEvidence: [{ experienceId: 'e2', weight: 0.9 }],
    })
    expect(result.supportingExperienceIds).toEqual(['e1', 'e3'])
    expect(result.conflictingExperienceIds).toEqual(['e2', 'e4'])
    expect(result.historicalVersionIds).toEqual(['b1:v1', 'b1:v2'])
  })

  it('rejects invalid weights and thresholds', () => {
    expect(() => reconcileSharkLongitudinalBelief({ history: current, supportingEvidence: [{ experienceId: 'e', weight: -1 }] })).toThrow()
    expect(() => reconcileSharkLongitudinalBelief({ history: current, conflictingEvidence: [{ experienceId: '', weight: 1 }] })).toThrow()
    expect(() => reconcileSharkLongitudinalBelief({ history: current, stabilityThreshold: 2 })).toThrow()
  })
})
