import type { ActionRequest } from './action-executor.js'

export const OVERAGE_ACTION_TYPES = [
  'overage.review',
  'overage.prepare_contact',
  'overage.prepare_claim',
  'overage.submit_claim',
] as const

export type OverageActionType = (typeof OVERAGE_ACTION_TYPES)[number]

export type VerifiedOpportunity = {
  opportunityId: string
  verificationId: string
  source: {
    key: string
    externalRecordId: string
    name: string
    url: string
  }
  property?: {
    reference: string
  }
  claimant: {
    name: string
  }
  economics: {
    amount: number
    currency: string
  }
  verification: {
    sourceRecord: 'verified'
    propertyReference: 'verified'
    claimantIdentity: 'verified'
    entitlement: 'verified'
  }
  verifiedAt: string
}

export type OverageAction = {
  opportunity: VerifiedOpportunity
  action: OverageActionType
}

export function createOverageActionRequest(input: {
  id: string
  userId: string
  opportunity: VerifiedOpportunity
  action: OverageActionType
  requestedAt?: string
}): ActionRequest<OverageAction> {
  assertVerifiedOpportunity(input.opportunity)

  return {
    id: input.id,
    userId: input.userId,
    type: input.action,
    action: {
      opportunity: input.opportunity,
      action: input.action,
    },
    requestedAt: input.requestedAt ?? new Date().toISOString(),
  }
}

export function assertVerifiedOpportunity(
  opportunity: VerifiedOpportunity,
): void {
  if (!opportunity.opportunityId) throw new Error('opportunityId is required.')
  if (!opportunity.verificationId) throw new Error('verificationId is required.')
  if (!opportunity.source.key || !opportunity.source.externalRecordId) {
    throw new Error('source key and external record ID are required.')
  }
  if (!opportunity.claimant.name) throw new Error('claimant name is required.')
  if (!Number.isFinite(opportunity.economics.amount) || opportunity.economics.amount < 0) {
    throw new Error('amount must be a finite non-negative number.')
  }
  if (!opportunity.economics.currency) throw new Error('currency is required.')
  if (
    opportunity.verification.sourceRecord !== 'verified' ||
    opportunity.verification.propertyReference !== 'verified' ||
    opportunity.verification.claimantIdentity !== 'verified' ||
    opportunity.verification.entitlement !== 'verified'
  ) {
    throw new Error('all overage verification checks must be verified.')
  }
  if (!opportunity.verifiedAt) throw new Error('verifiedAt is required.')
}
