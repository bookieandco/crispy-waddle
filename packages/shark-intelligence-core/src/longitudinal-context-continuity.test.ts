import { updateSharkLongitudinalContext } from './longitudinal-context-continuity'

describe('SHARK 1.50-B deterministic longitudinal context continuity', () => {
  const first = updateSharkLongitudinalContext({ current: null, contextId: 'c1', experienceIds: ['e1', 'e1'], beliefVersionIds: ['b1'], unresolvedContradictionIds: ['x1'], updatedAt: '2026-09-01T10:00:00Z' })

  it('creates stable versioned continuity state and deduplicates references', () => {
    expect(first.version).toBe(1)
    expect(first.parentContextId).toBeNull()
    expect(first.experienceIds).toEqual(['e1'])
  })

  it('advances monotonically and links the previous context', () => {
    const next = updateSharkLongitudinalContext({ current: first, contextId: 'c2', experienceIds: ['e1', 'e2'], beliefVersionIds: ['b1', 'b2'], unresolvedContradictionIds: ['x1', 'x2'], updatedAt: '2026-09-01T11:00:00Z' })
    expect(next.version).toBe(2)
    expect(next.parentContextId).toBe('c1')
    expect(next.experienceIds).toEqual(['e1', 'e2'])
  })

  it('rejects stale updates so older continuity cannot overwrite newer state', () => {
    expect(() => updateSharkLongitudinalContext({ current: first, contextId: 'late', experienceIds: [], beliefVersionIds: [], unresolvedContradictionIds: [], updatedAt: '2026-09-01T09:00:00Z' })).toThrow()
  })

  it('preserves contradictory references instead of deleting them', () => {
    const next = updateSharkLongitudinalContext({ current: first, contextId: 'c2', experienceIds: ['e2'], beliefVersionIds: ['b2'], unresolvedContradictionIds: ['x1', 'x3'], updatedAt: '2026-09-01T12:00:00Z' })
    expect(next.unresolvedContradictionIds).toEqual(['x1', 'x3'])
  })

  it('returns immutable state', () => {
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.experienceIds)).toBe(true)
  })
})
