import type { CreativeVariant, ExperimentMatrix } from './experiment-matrix.js'

export type SocialChannel = 'tiktok' | 'instagram' | 'youtube_shorts' | 'facebook' | 'pinterest' | 'x' | 'reddit' | 'email' | 'search'

export type SocialDistributionTarget = {
  id: string
  variantId: string
  opportunityId: string
  channel: SocialChannel
  campaignId?: string
  status: 'draft' | 'approved' | 'scheduled' | 'published' | 'cancelled'
  requiresApproval: boolean
}

export type SocialBridge = {
  matrixId: string
  targets: SocialDistributionTarget[]
}

export function buildSocialBridge(
  matrix: ExperimentMatrix,
  channels: SocialChannel[],
): SocialBridge {
  const targets: SocialDistributionTarget[] = []
  for (const variant of matrix.variants) {
    for (const channel of channels) {
      targets.push({
        id: `${variant.id}:${channel}`,
        variantId: variant.id,
        opportunityId: variant.opportunityId,
        channel,
        status: 'draft',
        requiresApproval: true,
      })
    }
  }
  return { matrixId: matrix.id, targets }
}

export function approveDistributionTarget(target: SocialDistributionTarget): SocialDistributionTarget {
  return { ...target, status: 'approved' }
}

export function canPublishDistributionTarget(target: SocialDistributionTarget): boolean {
  return target.status === 'approved'
}

export type { CreativeVariant }
