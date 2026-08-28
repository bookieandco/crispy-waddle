export type CreativeApprovalAction = 'approve' | 'reject' | 'revoke'

export type CreativeApprovalRequest = {
  id: string
  opportunityId: string
  variantId: string
  actorId: string
  action: CreativeApprovalAction
  reason?: string
  createdAt: string
}

export type CreativeApprovalDecision = {
  variantId: string
  approved: boolean
  actorId: string
  decidedAt: string
  reason?: string
}

/** Pure authorization boundary: creative generation never grants publish authority. */
export function applyCreativeApproval(
  currentStatus: 'draft' | 'approved' | 'scheduled' | 'published' | 'measured' | 'rejected',
  request: Pick<CreativeApprovalRequest, 'action' | 'actorId' | 'reason'>,
): CreativeApprovalDecision | never {
  if (!request.actorId) throw new Error('creative_approval_actor_required')
  if (currentStatus === 'published' || currentStatus === 'measured') throw new Error('creative_approval_immutable_after_publication')
  if (request.action === 'approve') return { variantId: '', approved: true, actorId: request.actorId, decidedAt: new Date().toISOString(), reason: request.reason }
  if (request.action === 'reject') return { variantId: '', approved: false, actorId: request.actorId, decidedAt: new Date().toISOString(), reason: request.reason }
  return { variantId: '', approved: false, actorId: request.actorId, decidedAt: new Date().toISOString(), reason: request.reason }
}
