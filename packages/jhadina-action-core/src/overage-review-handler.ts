import type { ActionHandler, ActionRequest } from './action-executor.js'
import {
  assertVerifiedOpportunity,
  type OverageAction,
  type VerifiedOpportunity,
} from './overage-opportunity-adapter.js'

export type OverageReviewResult = {
  status: 'reviewable'
  opportunityId: string
  verificationId: string
  sourceKey: string
  externalRecordId: string
  amount: number
  currency: string
  claimantName: string
  propertyReference?: string
  verifiedAt: string
}

/**
 * Read-only Overage review handler.
 *
 * This handler deliberately produces an internal review result only. It does
 * not contact a claimant, file a claim, submit anything externally, or move
 * money.
 */
export class OverageReviewHandler
  implements ActionHandler<OverageAction, OverageReviewResult>
{
  supports(type: string): boolean {
    return type === 'overage.review'
  }

  async execute(
    action: OverageAction,
    _request: ActionRequest<OverageAction>,
  ): Promise<OverageReviewResult> {
    if (action.action !== 'overage.review') {
      throw new Error('OverageReviewHandler only accepts overage.review actions.')
    }

    const opportunity: VerifiedOpportunity = action.opportunity
    assertVerifiedOpportunity(opportunity)

    return {
      status: 'reviewable',
      opportunityId: opportunity.opportunityId,
      verificationId: opportunity.verificationId,
      sourceKey: opportunity.source.key,
      externalRecordId: opportunity.source.externalRecordId,
      amount: opportunity.economics.amount,
      currency: opportunity.economics.currency,
      claimantName: opportunity.claimant.name,
      propertyReference: opportunity.property?.reference,
      verifiedAt: opportunity.verifiedAt,
    }
  }
}
