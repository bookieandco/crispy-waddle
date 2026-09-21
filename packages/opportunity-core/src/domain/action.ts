import type { Opportunity } from './opportunity.js'
import type { OpportunityPursuitCase } from './pursuit.js'
import { isPursuitReady } from './pursuit.js'

export type OpportunityExecutionOwner =
  | 'placement'
  | 'overageos'
  | 'commerce'
  | 'pupsonstuff'
  | 'director'
  | 'money'
  | 'action_core'
  | 'user'

export type OpportunityActionIntent = {
  id: string
  opportunityId: string
  researchCaseId: string
  executionOwner: OpportunityExecutionOwner
  capability: string
  evidenceRefs: string[]
  requiresPolicy: true
  requiresApproval: true
  createdAt: string
  expiresAt: string
}

/**
 * Final Opportunity-Core boundary. This creates an intent for the owning
 * governed subsystem; it never executes the action itself.
 */
export function createOpportunityActionIntent(input: {
  opportunity: Opportunity
  pursuitCase: OpportunityPursuitCase
  executionOwner: OpportunityExecutionOwner
  capability: string
  evidenceRefs: string[]
  createdAt: string
  expiresAt: string
}): OpportunityActionIntent {
  if (input.opportunity.status !== 'ready') throw new Error('Opportunity must be ready before action handoff')
  if (input.pursuitCase.opportunityId !== input.opportunity.id || !isPursuitReady(input.pursuitCase)) {
    throw new Error('Evidence-complete pursuit case is required before action handoff')
  }
  if (!input.capability.trim()) throw new Error('Action capability is required')
  if (input.evidenceRefs.length === 0 || input.evidenceRefs.some((ref) => !ref.trim())) throw new Error('Action intent requires non-empty evidence references')
  const createdAt = Date.parse(input.createdAt)
  const expiresAt = Date.parse(input.expiresAt)
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) {
    throw new Error('Action intent expiry is invalid')
  }

  return {
    id: `opportunity-action:${input.opportunity.id}:${input.capability}`,
    opportunityId: input.opportunity.id,
    researchCaseId: input.pursuitCase.id,
    executionOwner: input.executionOwner,
    capability: input.capability,
    evidenceRefs: [...input.evidenceRefs],
    requiresPolicy: true,
    requiresApproval: true,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  }
}


export function createDropshippingProcurementActionIntent(input: {
  opportunity: Opportunity
  pursuitCase: OpportunityPursuitCase
  evidenceRefs: string[]
  createdAt: string
  expiresAt: string
}): OpportunityActionIntent {
  if (input.opportunity.metadata?.commercialKind !== 'dropshipping') {
    throw new Error('Dropshipping procurement handoff requires a dropshipping opportunity')
  }
  return createOpportunityActionIntent({
    opportunity: input.opportunity,
    pursuitCase: input.pursuitCase,
    executionOwner: 'commerce',
    capability: 'commerce.supplier.procure',
    evidenceRefs: input.evidenceRefs,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  })
}
