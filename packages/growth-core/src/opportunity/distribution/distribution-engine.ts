import type { SocialDistributionTarget } from '../creative/social-bridge.js'

export type DistributionAction = 'approve' | 'schedule' | 'publish' | 'cancel'

export type DistributionRequest = {
  id: string
  target: SocialDistributionTarget
  action: DistributionAction
  actorId: string
  scheduledFor?: string
}

export type DistributionResult = {
  requestId: string
  targetId: string
  status: 'approved' | 'scheduled' | 'published' | 'cancelled'
  executed: boolean
}

/** The engine prepares/records authorized distribution; provider-specific publishing remains an adapter concern. */
export function executeDistribution(request: DistributionRequest): DistributionResult {
  if (!request.actorId) throw new Error('distribution_actor_required')
  if (request.target.requiresApproval && request.target.status !== 'approved') {
    throw new Error('distribution_approval_required')
  }
  if (request.action === 'publish' && request.target.status !== 'approved') {
    throw new Error('distribution_publish_requires_approval')
  }
  if (request.action === 'schedule' && !request.scheduledFor) {
    throw new Error('distribution_schedule_time_required')
  }
  const status = request.action === 'publish' ? 'published' : request.action === 'schedule' ? 'scheduled' : request.action === 'cancel' ? 'cancelled' : 'approved'
  return { requestId: request.id, targetId: request.target.id, status, executed: request.action !== 'approve' }
}
