export type CanonicalOpportunityStatus = 'OPEN' | 'CLOSED' | 'AWARDED' | 'CANCELLED' | 'UNKNOWN'

export interface RawProcurementOpportunity {
  sourceId: string
  externalId?: string
  title: string
  description?: string
  jurisdiction: string
  jurisdictionLevel: string
  postedAt?: string
  deadlineAt?: string
  status?: string
  estimatedValue?: number
  currency?: string
  url: string
  capabilities?: string[]
}

export interface CanonicalProcurementOpportunity {
  canonicalId: string
  sourceId: string
  externalId?: string
  title: string
  description?: string
  jurisdiction: string
  jurisdictionLevel: string
  postedAt?: string
  deadlineAt?: string
  status: CanonicalOpportunityStatus
  estimatedValue?: number
  currency: string
  url: string
  capabilities: string[]
  provenance: { sourceId: string; externalId?: string; normalizedAt: string }
}

function normalizeStatus(status?: string): CanonicalOpportunityStatus {
  const value = status?.trim().toLowerCase()
  if (!value) return 'UNKNOWN'
  if (['open', 'active', 'published', 'current'].includes(value)) return 'OPEN'
  if (['closed', 'expired', 'past deadline'].includes(value)) return 'CLOSED'
  if (['awarded', 'award'].includes(value)) return 'AWARDED'
  if (['cancelled', 'canceled', 'withdrawn'].includes(value)) return 'CANCELLED'
  return 'UNKNOWN'
}

function canonicalId(input: RawProcurementOpportunity): string {
  const key = `${input.sourceId}|${input.externalId ?? ''}|${input.url}`.trim().toLowerCase()
  return `proc-${Array.from(key).reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 7).toString(16)}`
}

/** Converts source-specific procurement records into the canonical OCE opportunity contract. */
export function normalizeProcurementOpportunity(input: RawProcurementOpportunity, normalizedAt = new Date().toISOString()): CanonicalProcurementOpportunity {
  if (!input.sourceId || !input.title.trim() || !input.jurisdiction.trim() || !input.jurisdictionLevel.trim() || !input.url.trim()) {
    throw new Error('sourceId, title, jurisdiction, jurisdictionLevel, and url are required')
  }

  return {
    canonicalId: canonicalId(input),
    sourceId: input.sourceId,
    externalId: input.externalId?.trim() || undefined,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    jurisdiction: input.jurisdiction.trim(),
    jurisdictionLevel: input.jurisdictionLevel.trim(),
    postedAt: input.postedAt,
    deadlineAt: input.deadlineAt,
    status: normalizeStatus(input.status),
    estimatedValue: input.estimatedValue,
    currency: input.currency?.trim().toUpperCase() || 'USD',
    url: input.url.trim(),
    capabilities: [...new Set((input.capabilities ?? []).map((value) => value.trim()).filter(Boolean))].sort(),
    provenance: { sourceId: input.sourceId, externalId: input.externalId?.trim() || undefined, normalizedAt },
  }
}
