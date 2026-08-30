import { appendSharkBeliefVersion, getCurrentSharkBeliefVersion } from './belief-history'

describe('SHARK 1.46-B belief history/versioning', () => {
  const history = { beliefId: 'b1', versions: [] }

  it('appends immutable versions and reconstructs the current version', () => {
    const v1 = appendSharkBeliefVersion({ history, confidence: 0.4, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: [] })
    const v2 = appendSharkBeliefVersion({ history: v1, confidence: 0.75, updateId: 'u2', proposalId: 'p2', supportingExperienceIds: ['e1', 'e3'], conflictingExperienceIds: ['e2'] })
    expect(v2.versions.map(v => v.version)).toEqual([1, 2])
    expect(getCurrentSharkBeliefVersion(v2)?.confidence).toBe(0.75)
    expect(v1.versions).toHaveLength(1)
  })

  it('supports confidence decreasing without losing prior belief state', () => {
    const v1 = appendSharkBeliefVersion({ history, confidence: 0.9, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: [] })
    const v2 = appendSharkBeliefVersion({ history: v1, confidence: 0.3, updateId: 'u2', proposalId: 'p2', supportingExperienceIds: [], conflictingExperienceIds: ['e2'] })
    expect(v2.versions[0].confidence).toBe(0.9)
    expect(v2.versions[1].confidence).toBe(0.3)
  })

  it('retains contradictory experience references and deduplicates them', () => {
    const result = appendSharkBeliefVersion({ history, confidence: 0.5, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: ['e1', 'e1'], conflictingExperienceIds: ['e2', 'e2'] })
    expect(result.versions[0].supportingExperienceIds).toEqual(['e1'])
    expect(result.versions[0].conflictingExperienceIds).toEqual(['e2'])
  })

  it('rejects duplicate updates and invalid inputs', () => {
    const v1 = appendSharkBeliefVersion({ history, confidence: 0.5, updateId: 'u1', proposalId: 'p1', supportingExperienceIds: [], conflictingExperienceIds: [] })
    expect(() => appendSharkBeliefVersion({ history: v1, confidence: 0.6, updateId: 'u1', proposalId: 'p2', supportingExperienceIds: [], conflictingExperienceIds: [] })).toThrow()
    expect(() => appendSharkBeliefVersion({ history, confidence: 1.2, updateId: 'u2', proposalId: 'p2', supportingExperienceIds: [], conflictingExperienceIds: [] })).toThrow()
  })
})
