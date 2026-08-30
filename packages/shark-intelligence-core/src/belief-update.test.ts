import { applyValidatedSharkBeliefUpdate } from './belief-update'

describe('SHARK 1.46-A validated belief updating', () => {
  it('updates belief confidence only from validated evidence', () => {
    const result = applyValidatedSharkBeliefUpdate({
      updateId: 'u1', beliefId: 'b1', previousConfidence: 0.4, newConfidence: 0.75,
      proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e2'], validated: true,
    })
    expect(result.previousConfidence).toBe(0.4)
    expect(result.newConfidence).toBe(0.75)
    expect(result.validated).toBe(true)
    expect(result.supportingExperienceIds).toEqual(['e1'])
    expect(result.conflictingExperienceIds).toEqual(['e2'])
  })

  it('rejects unvalidated updates', () => {
    expect(() => applyValidatedSharkBeliefUpdate({
      updateId: 'u1', beliefId: 'b1', previousConfidence: 0.4, newConfidence: 0.75,
      proposalId: 'p1', supportingExperienceIds: ['e1'], conflictingExperienceIds: [], validated: false,
    })).toThrow()
  })

  it('preserves the previous belief state and deduplicates evidence references', () => {
    const result = applyValidatedSharkBeliefUpdate({
      updateId: 'u2', beliefId: 'b1', previousConfidence: 0.8, newConfidence: 0.5,
      proposalId: 'p2', supportingExperienceIds: ['e1', 'e1'], conflictingExperienceIds: ['e2', 'e2'], validated: true,
    })
    expect(result.previousConfidence).toBe(0.8)
    expect(result.newConfidence).toBe(0.5)
    expect(result.supportingExperienceIds).toEqual(['e1'])
    expect(result.conflictingExperienceIds).toEqual(['e2'])
  })

  it('rejects invalid confidence or identity', () => {
    expect(() => applyValidatedSharkBeliefUpdate({ updateId: 'u', beliefId: 'b', previousConfidence: 1.1, newConfidence: 0.5, proposalId: 'p', supportingExperienceIds: [], conflictingExperienceIds: [], validated: true })).toThrow()
    expect(() => applyValidatedSharkBeliefUpdate({ updateId: ' ', beliefId: 'b', previousConfidence: 0.5, newConfidence: 0.5, proposalId: 'p', supportingExperienceIds: [], conflictingExperienceIds: [], validated: true })).toThrow()
  })
})
