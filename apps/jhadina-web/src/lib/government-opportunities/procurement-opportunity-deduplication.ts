import type { CanonicalProcurementOpportunity } from './procurement-opportunity-normalization'

export interface OpportunitySourceRecord {
  sourceId: string
  externalId?: string
  canonicalId: string
  firstSeenAt: string
  lastSeenAt: string
  fingerprint: string
}

export interface DeduplicatedOpportunity {
  canonicalId: string
  sourceRecords: OpportunitySourceRecord[]
  opportunity: CanonicalProcurementOpportunity
  duplicateCount: number
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
}

export function opportunityFingerprint(opportunity: CanonicalProcurementOpportunity): string {
  const external = normalize(opportunity.externalId)
  if (external) return `${normalize(opportunity.sourceId)}|${external}`
  return [normalize(opportunity.title), normalize(opportunity.jurisdiction), normalize(opportunity.deadlineAt)].join('|')
}

/** Deduplicates normalized records while preserving every contributing source record. */
export function deduplicateProcurementOpportunities(
  opportunities: CanonicalProcurementOpportunity[],
  observedAt = new Date().toISOString(),
): DeduplicatedOpportunity[] {
  const groups = new Map<string, DeduplicatedOpportunity>()
  for (const opportunity of opportunities) {
    const fingerprint = opportunityFingerprint(opportunity)
    const existing = groups.get(fingerprint)
    const sourceRecord: OpportunitySourceRecord = {
      sourceId: opportunity.sourceId,
      externalId: opportunity.externalId,
      canonicalId: opportunity.canonicalId,
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      fingerprint,
    }
    if (!existing) {
      groups.set(fingerprint, { canonicalId: opportunity.canonicalId, sourceRecords: [sourceRecord], opportunity, duplicateCount: 0 })
      continue
    }
    existing.sourceRecords.push(sourceRecord)
    existing.duplicateCount += 1
  }
  return [...groups.values()].map((group) => ({
    ...group,
    sourceRecords: group.sourceRecords.sort((a, b) => `${a.sourceId}|${a.externalId ?? ''}`.localeCompare(`${b.sourceId}|${b.externalId ?? ''}`)),
  }))
}
