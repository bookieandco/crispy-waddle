import type { Opportunity } from './domain/opportunity.js'

export type OpportunityMinerCandidate = {
  id: string
  title: string
  summary: string
  sourceUrl?: string
  sourceName: string
  sourceType?: 'content' | 'market_intelligence' | 'commercial_offer'
  buyer?: string
  problem?: string
  evidenceSummary?: string
  evidenceConfidence?: number
  estimatedRevenue?: { min?: number; max?: number }
  startupCost?: number
  estimatedHours?: number
  recurringRevenue?: boolean
}

/**
 * Deterministic boundary for future Opportunity Miner output.
 * The miner may use an LLM upstream for extraction, but this adapter owns
 * normalization and never treats an extracted claim as verified fact.
 */
export function adaptOpportunityMinerCandidate(item: OpportunityMinerCandidate, userId: string): Opportunity {
  const now = new Date().toISOString()
  const confidence = Math.max(0, Math.min(1, item.evidenceConfidence ?? 0.25))
  const sourceType = item.sourceType === 'commercial_offer' ? 'market_intelligence' : (item.sourceType ?? 'content')

  return {
    id: `miner:${item.id}`,
    userId,
    title: item.title,
    description: item.summary,
    class: 'experiment',
    strategy: 'experiment',
    source: { type: sourceType, name: item.sourceName, url: item.sourceUrl, externalId: item.id },
    buyer: item.buyer ? { segment: item.buyer } : undefined,
    problem: item.problem,
    evidence: [
      {
        type: item.evidenceSummary ? 'claim' : 'source',
        summary: item.evidenceSummary ?? item.summary,
        sourceUrl: item.sourceUrl,
        confidence,
      },
    ],
    economics: {
      currency: 'USD',
      estimatedRevenue: item.estimatedRevenue,
      startupCost: item.startupCost,
      estimatedHours: item.estimatedHours,
      recurringRevenue: item.recurringRevenue,
    },
    status: 'discovered',
    requiresApproval: true,
    createdAt: now,
    updatedAt: now,
  }
}

export function adaptOpportunityMinerCandidates(items: readonly OpportunityMinerCandidate[], userId: string): Opportunity[] {
  return items.map((item) => adaptOpportunityMinerCandidate(item, userId))
}
