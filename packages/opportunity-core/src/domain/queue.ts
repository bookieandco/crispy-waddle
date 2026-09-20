import type { Opportunity } from './opportunity.js'

export type OpportunityQueueFilter = {
  status?: Opportunity['status']
  family?: Opportunity['family']
  sourceId?: string
  includeExpired?: boolean
  includeInactive?: boolean
}

export type OpportunityQueueEntry = {
  opportunity: Opportunity
  rank: number
  freshestEvidenceAt?: string
}

export function freshestOpportunityEvidenceAt(opportunity: Opportunity): string | undefined {
  const captured = opportunity.evidence
    .map((evidence) => evidence.capturedAt)
    .filter(Boolean)
    .sort()
  return captured.length > 0 ? captured[captured.length - 1] : undefined
}

/**
 * Deterministic canonical queue derived from OCE-4's useful behavior without
 * restoring Growth's competing Opportunity aggregate. Stable canonical IDs
 * are the deduplication key; the newest updatedAt wins.
 */
export class CanonicalOpportunityQueue {
  private readonly entries = new Map<string, Opportunity>()

  ingest(opportunities: readonly Opportunity[]): OpportunityQueueEntry[] {
    for (const opportunity of opportunities) {
      const existing = this.entries.get(opportunity.id)
      if (!existing || opportunity.updatedAt >= existing.updatedAt) {
        this.entries.set(opportunity.id, opportunity)
      }
    }
    return this.list()
  }

  list(filter: OpportunityQueueFilter = {}, now = new Date().toISOString()): OpportunityQueueEntry[] {
    return [...this.entries.values()]
      .filter((opportunity) => !filter.status || opportunity.status === filter.status)
      .filter((opportunity) => !filter.family || opportunity.family === filter.family)
      .filter((opportunity) => !filter.sourceId || opportunity.sourceId === filter.sourceId)
      .filter((opportunity) => filter.includeInactive || !['expired','rejected','superseded'].includes(opportunity.status))
      .filter((opportunity) => filter.includeExpired || !isExpired(opportunity.deadline, now))
      .sort(compareOpportunities)
      .map((opportunity, index) => ({
        opportunity,
        rank: index + 1,
        freshestEvidenceAt: freshestOpportunityEvidenceAt(opportunity),
      }))
  }

  size(): number {
    return this.entries.size
  }
}

function compareOpportunities(a: Opportunity, b: Opportunity): number {
  const scoreDelta = scoreValue(b) - scoreValue(a)
  if (scoreDelta !== 0) return scoreDelta

  const evidenceDelta = (freshestOpportunityEvidenceAt(b) ?? '').localeCompare(freshestOpportunityEvidenceAt(a) ?? '')
  if (evidenceDelta !== 0) return evidenceDelta

  return b.updatedAt.localeCompare(a.updatedAt)
}

function scoreValue(opportunity: Opportunity): number {
  if (typeof opportunity.opportunityScore === 'number') return opportunity.opportunityScore
  if (typeof opportunity.fitScore === 'number') return opportunity.fitScore
  if (typeof opportunity.expectedValue === 'number') return opportunity.expectedValue
  return 0
}

function isExpired(deadline: string | undefined, now: string): boolean {
  if (!deadline) return false
  const deadlineMs = Date.parse(deadline)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return false
  return deadlineMs < nowMs
}
