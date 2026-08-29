import type { OpportunityEvidence } from '@jhadina/opportunity-core'
import type { SharkEvidence } from './index.js'

const sourceTypeMap: Record<OpportunityEvidence['sourceType'], SharkEvidence['sourceType']> = {
  official: 'research',
  secondary: 'research',
  user: 'system',
  transcript: 'community',
  model: 'system',
}

/**
 * Adapt canonical Opportunity Core evidence into Shark evidence without
 * replacing its source identity, capture time, or verification metadata.
 */
export function adaptOpportunityEvidence(evidence: OpportunityEvidence): SharkEvidence {
  return {
    sourceId: evidence.sourceId,
    sourceType: sourceTypeMap[evidence.sourceType],
    observedAt: evidence.capturedAt,
    signal: evidence.excerpt ?? evidence.sourceName,
    strength: Math.max(0, Math.min(1, evidence.confidence)),
    verified: evidence.verified,
    metadata: {
      evidenceId: evidence.id,
      sourceType: evidence.sourceType,
      sourceName: evidence.sourceName,
      sourceUrl: evidence.sourceUrl,
    },
  }
}

export function adaptOpportunityEvidenceSet(evidence: OpportunityEvidence[]): SharkEvidence[] {
  return evidence.map(adaptOpportunityEvidence)
}
