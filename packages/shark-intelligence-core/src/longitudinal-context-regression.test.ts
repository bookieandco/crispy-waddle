import { updateSharkLongitudinalContext } from './longitudinal-context-continuity'

describe('SHARK 1.50-C longitudinal continuity regression', () => {
  it('rejects out-of-order updates', () => {
    const first = updateSharkLongitudinalContext({ current: null, contextId: 'c1', experienceIds: ['e1'], beliefVersionIds: ['b1'], unresolvedContradictionIds: ['x1'], updatedAt: '2026-09-01T10:00:00Z' })
    expect(() => updateSharkLongitudinalContext({ current: first, contextId: 'late', experienceIds: ['e2'], beliefVersionIds: ['b2'], unresolvedContradictionIds: ['x2'], updatedAt: '2026-09-01T09:59:00Z' })).toThrow()
  })

  it('deduplicates repeated references without deleting distinct history', () => {
    const state = updateSharkLongitudinalContext({ current: null, contextId: 'c1', experienceIds: ['e1', 'e1', 'e2'], beliefVersionIds: ['b1', 'b1', 'b2'], unresolvedContradictionIds: ['x1', 'x1', 'x2'], updatedAt: '2026-09-01T10:00:00Z' })
    expect(state.experienceIds).toEqual(['e1', 'e2'])
    expect(state.beliefVersionIds).toEqual(['b1', 'b2'])
    expect(state.unresolvedContradictionIds).toEqual(['x1', 'x2'])
  })

  it('increments versions monotonically across successive contexts', () => {
    const first = updateSharkLongitudinalContext({ current: null, contextId: 'c1', experienceIds: ['e1'], beliefVersionIds: ['b1'], unresolvedContradictionIds: ['x1'], updatedAt: '2026-09-01T10:00:00Z' })
    const second = updateSharkLongitudinalContext({ current: first, contextId: 'c2', experienceIds: ['e1', 'e2'], beliefVersionIds: ['b1', 'b2'], unresolvedContradictionIds: ['x1'], updatedAt: '2026-09-01T11:00:00Z' })
    const third = updateSharkLongitudinalContext({ current: second, contextId: 'c3', experienceIds: ['e2', 'e3'], beliefVersionIds: ['b2', 'b3'], unresolvedContradictionIds: ['x1', 'x3'], updatedAt: '2026-09-01T12:00:00Z' })
    expect([first.version, second.version, third.version]).toEqual([1, 2, 3])
    expect(third.parentContextId).toBe('c2')
  })

  it('preserves contradictions when newer contexts introduce additional evidence', () => {
    const first = updateSharkLongitudinalContext({ current: null, contextId: 'c1', experienceIds: ['e1'], beliefVersionIds: ['b1'], unresolvedContradictionIds: ['x1'], updatedAt: '2026-09-01T10:00:00Z' })
    const second = updateSharkLongitudinalContext({ current: first, contextId: 'c2', experienceIds: ['e1', 'e2'], beliefVersionIds: ['b1', 'b2'], unresolvedContradictionIds: ['x1', 'x2'], updatedAt: '2026-09-01T11:00:00Z' })
    expect(second.unresolvedContradictionIds).toEqual(['x1', 'x2'])
  })
})
