import type { Opportunity } from '@jhadina/growth-core'
import { adaptLegacyOpportunity } from './canonical-adapter'
import { adaptSamNotice, type SamNotice } from '../money-opportunities/sam-opportunity-adapter'

/**
 * Keeps the existing SAM parser/risk heuristics intact while making the
 * canonical Opportunity Core the normalized contract exposed to consumers.
 */
export function adaptSamNoticeToCanonical(notice: SamNotice, userId = 'default'): Opportunity {
  const legacy = adaptSamNotice(notice, userId)
  const canonical = adaptLegacyOpportunity(legacy)

  return {
    ...canonical,
    class: 'earn',
    strategy: 'government_contract',
    source: {
      ...canonical.source,
      type: 'government',
      name: 'SAM.gov',
      externalId: legacy.id,
    },
    buyer: { segment: 'government', geography: 'United States' },
    problem: 'Government procurement need represented by a SAM.gov notice.',
    evidence: [
      ...canonical.evidence,
      {
        type: 'source',
        summary: 'Opportunity was discovered through the SAM.gov source adapter.',
        sourceUrl: legacy.sourceUrl,
        confidence: legacy.sourceConfidence ?? 0,
      },
    ],
  }
}

export function adaptSamResultsToCanonical(data: unknown, userId = 'default'): Opportunity[] {
  const root = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const raw = Array.isArray(root.opportunities)
    ? root.opportunities
    : Array.isArray(root.results)
      ? root.results
      : Array.isArray(data)
        ? data
        : []

  return raw
    .filter((item): item is SamNotice => Boolean(item && typeof item === 'object'))
    .map((item) => adaptSamNoticeToCanonical(item, userId))
}
