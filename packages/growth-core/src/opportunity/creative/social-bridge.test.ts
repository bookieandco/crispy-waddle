import { describe, expect, it } from 'vitest'
import { approveDistributionTarget, buildSocialBridge, canPublishDistributionTarget } from './social-bridge.js'

describe('Social Media OS bridge', () => {
  it('fans each creative variant out to selected channels while preserving lineage', () => {
    const matrix = {
      id: 'matrix-dna-1', opportunityId: 'opp-1', creativeDnaId: 'dna-1', requiresApproval: true,
      variants: [{ id: 'dna-1:1', opportunityId: 'opp-1', creativeDnaId: 'dna-1', hook: { text: 'h' }, body: { structure: 'b' }, cta: { text: 'c', action: 'click' as const }, status: 'draft' as const }],
    }
    const bridge = buildSocialBridge(matrix, ['tiktok', 'youtube_shorts'])
    expect(bridge.targets).toHaveLength(2)
    expect(bridge.targets.map(t => t.id)).toEqual(['dna-1:1:tiktok', 'dna-1:1:youtube_shorts'])
    expect(bridge.targets.every(t => t.opportunityId === 'opp-1' && t.requiresApproval)).toBe(true)
  })

  it('requires explicit approval before publication', () => {
    const target = { id: 'x', variantId: 'v', opportunityId: 'o', channel: 'tiktok' as const, status: 'draft' as const, requiresApproval: true }
    expect(canPublishDistributionTarget(target)).toBe(false)
    expect(canPublishDistributionTarget(approveDistributionTarget(target))).toBe(true)
  })
})
