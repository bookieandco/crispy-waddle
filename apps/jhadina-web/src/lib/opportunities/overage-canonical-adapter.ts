import type { Opportunity } from '@jhadina/growth-core'
import { buildOverageOpportunity, type OverageOpportunityCandidate } from './overageAdapter.js'

/**
 * Canonical boundary for OverageOS. The existing Overage adapter remains
 * responsible for the legacy shape and its safety constraints; this adapter
 * only maps that result into Opportunity Core.
 */
export function adaptOverageOpportunity(
  candidate: OverageOpportunityCandidate,
  userId: string,
): Opportunity {
  const legacy = buildOverageOpportunity(candidate, userId)
  const now = new Date().toISOString()

  return {
    id: `overage:${candidate.sourceKey}:${candidate.externalRecordId}`,
    userId,
    title: legacy.title,
    description: legacy.summary,
    class: 'experiment',
    strategy: 'experiment',
    source: {
      type: 'overage',
      name: candidate.sourceName,
      url: candidate.sourceUrl,
      externalId: candidate.externalRecordId,
    },
    problem: 'Recover potentially unclaimed surplus proceeds through an authorized verification workflow.',
    evidence: [
      {
        type: 'source',
        summary: candidate.evidenceSummary ?? legacy.summary,
        sourceUrl: candidate.sourceUrl,
        confidence: candidate.sourceConfidence,
      },
    ],
    economics: {
      currency: candidate.currency,
      estimatedRevenue: { min: candidate.amount, max: candidate.amount },
      paymentLikelihood: candidate.sourceConfidence,
    },
    status: 'discovered',
    requiresApproval: true,
    createdAt: now,
    updatedAt: now,
  }
}

export function adaptOverageOpportunities(
  candidates: readonly OverageOpportunityCandidate[],
  userId: string,
): Opportunity[] {
  return candidates.map((candidate) => adaptOverageOpportunity(candidate, userId))
}
