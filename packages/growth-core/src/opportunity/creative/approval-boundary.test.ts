import { describe, expect, it } from 'vitest'
import { applyCreativeApproval } from './approval-boundary.js'

describe('Creative approval boundary', () => {
  it('requires an approving actor', () => {
    expect(() => applyCreativeApproval('draft', { action: 'approve', actorId: '' })).toThrow('creative_approval_actor_required')
  })

  it('allows approval only before publication', () => {
    const decision = applyCreativeApproval('draft', { action: 'approve', actorId: 'user-1' })
    expect(decision.approved).toBe(true)
    expect(decision.actorId).toBe('user-1')
  })

  it('does not allow a published creative to be changed by this boundary', () => {
    expect(() => applyCreativeApproval('published', { action: 'revoke', actorId: 'user-1' })).toThrow('creative_approval_immutable_after_publication')
  })
})
