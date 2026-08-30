import type { Opportunity } from '../domain/opportunity.js'
import { transitionOpportunityStatus } from '../domain/opportunity-status.js'
import type { OpportunityStatus } from '../domain/opportunity-status.js'

export type OpportunityLifecycleEvent = {
  opportunityId: string
  from: OpportunityStatus
  to: OpportunityStatus
  at: string
  actor: 'system' | 'user'
}

export class OpportunityWorkflow {
  transition(
    opportunity: Opportunity,
    to: OpportunityStatus,
    event: Omit<OpportunityLifecycleEvent, 'from' | 'to' | 'opportunityId'>,
  ): { opportunity: Opportunity; event: OpportunityLifecycleEvent } {
    const from = opportunity.status
    const next = transitionOpportunityStatus(from, to)
    const updated = { ...opportunity, status: next, updatedAt: event.at }
    return {
      opportunity: updated,
      event: { ...event, opportunityId: opportunity.id, from, to: next },
    }
  }
}
