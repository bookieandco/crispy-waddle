import { reconcileSharkBeliefHistory } from './belief-reconciliation'

describe('SHARK 1.46-D belief reconciliation regression', () => {
  const version = (version: number, confidence: number, updateId: string) => ({
    beliefId: 'b1', version, confidence, updateId, proposalId: `p-${updateId}`,
    supportingExperienceIds: ['support-1'], conflictingExperienceIds: ['conflict-1'],
  })

  it('handles reinforcement -> contradiction -> reinforcement without losing history', () => {
    const history = {
      beliefId: 'b1',
      versions: [version(1, 0.4, 'u1'), version(2, 0.85, 'u2'), version(3, 0.25, 'u3'), version(4, 0.8, 'u4')],
    }
    const result = reconcileSharkBeliefHistory({ history })
    expect(history.versions).toHaveLength(4)
    expect(history.versions.map(v => v.confidence)).toEqual([0.4, 0.85, 0.25, 0.8])
    expect(result.currentConfidence).toBe(0.8)
    expect(result.versionCount).toBe(4)
  })

  it('does not treat a later reinforcement as deletion of contradictory evidence', () => {
    const history = { beliefId: 'b1', versions: [version(1, 0.7, 'u1'), version(2, 0.3, 'u2'), version(3, 0.75, 'u3')] }
    const result = reconcileSharkBeliefHistory({ history, newConflictingExperienceIds: ['conflict-2'] })
    expect(result.conflictingExperienceIds).toEqual(['conflict-1', 'conflict-2'])
  })

  it('classifies repeated evidence trajectories deterministically', () => {
    const history = { beliefId: 'b1', versions: [version(1, 0.5, 'u1'), version(2, 0.5, 'u2'), version(3, 0.5, 'u3')] }
    expect(reconcileSharkBeliefHistory({ history }).direction).toBe('stable')
  })
})
