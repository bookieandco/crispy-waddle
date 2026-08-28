import type { CanonicalProcurementOpportunity } from './procurement-opportunity-normalization'

export type OpportunityLifecycleEventType = 'POSTED' | 'AMENDMENT' | 'DEADLINE_CHANGED' | 'SCOPE_CHANGED' | 'Q_AND_A' | 'CLOSED' | 'AWARDED' | 'CANCELLED' | 'REBID'

export interface OpportunityLifecycleEvent {
  opportunityId: string
  type: OpportunityLifecycleEventType
  observedAt: string
  effectiveAt?: string
  sourceId: string
  evidenceId?: string
  previousValue?: unknown
  newValue?: unknown
  summary: string
}

export interface OpportunityLifecycle {
  opportunityId: string
  current: CanonicalProcurementOpportunity
  events: OpportunityLifecycleEvent[]
  lastObservedAt: string
  amendmentCount: number
  awardObserved: boolean
  rebidSignal: boolean
}

/** Builds an auditable event timeline while keeping the current opportunity separate. */
export function buildOpportunityLifecycle(opportunity: CanonicalProcurementOpportunity, events: OpportunityLifecycleEvent[]): OpportunityLifecycle {
  const ordered = events.filter((event) => event.opportunityId === opportunity.canonicalId).sort((a, b) => a.observedAt.localeCompare(b.observedAt))
  return {
    opportunityId: opportunity.canonicalId,
    current: opportunity,
    events: ordered,
    lastObservedAt: ordered.at(-1)?.observedAt ?? opportunity.provenance.normalizedAt,
    amendmentCount: ordered.filter((event) => event.type === 'AMENDMENT').length,
    awardObserved: ordered.some((event) => event.type === 'AWARDED'),
    rebidSignal: ordered.some((event) => event.type === 'REBID'),
  }
}

export function createLifecycleEvent(opportunityId: string, sourceId: string, type: OpportunityLifecycleEventType, summary: string, observedAt = new Date().toISOString(), details: Pick<OpportunityLifecycleEvent, 'effectiveAt' | 'evidenceId' | 'previousValue' | 'newValue'> = {}): OpportunityLifecycleEvent {
  if (!opportunityId || !sourceId || !summary.trim()) throw new Error('opportunityId, sourceId, and summary are required')
  return { opportunityId, sourceId, type, summary: summary.trim(), observedAt, ...details }
}
