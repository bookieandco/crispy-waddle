import { describe, expect, it } from 'vitest'
import { executeDistribution } from './distribution-engine.js'

const target = { id: 'v1:tiktok', variantId: 'v1', opportunityId: 'opp-1', channel: 'tiktok' as const, status: 'approved' as const, requiresApproval: true }

describe('Distribution Engine', () => {
  it('requires an actor and approved target', () => {
    expect(() => executeDistribution({ id: 'r1', target: { ...target, status: 'draft' }, action: 'publish', actorId: 'user-1' })).toThrow('distribution_approval_required')
    expect(() => executeDistribution({ id: 'r1', target, action: 'publish', actorId: '' })).toThrow('distribution_actor_required')
  })

  it('requires a schedule time', () => {
    expect(() => executeDistribution({ id: 'r1', target, action: 'schedule', actorId: 'user-1' })).toThrow('distribution_schedule_time_required')
  })

  it('returns a publish result without coupling to a social provider', () => {
    expect(executeDistribution({ id: 'r1', target, action: 'publish', actorId: 'user-1' })).toMatchObject({ requestId: 'r1', targetId: 'v1:tiktok', status: 'published', executed: true })
  })
})
