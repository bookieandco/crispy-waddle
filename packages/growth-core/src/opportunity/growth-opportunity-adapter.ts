import type { GrowthOpportunity } from '../intelligence/opportunity-engine.js'
import type { Opportunity } from './domain/opportunity.js'

/** Normalize an existing Growth opportunity into Opportunity Core. */
export function adaptGrowthOpportunity(item: GrowthOpportunity, userId: string): Opportunity {
  const now = new Date().toISOString()
  const confidence = Math.max(0, Math.min(1, item.confidence))

  return {
    id: `growth:${item.key}`,
    userId,
    title: `Growth opportunity — ${item.key}`,
    description: item.rationale,
    class: 'experiment',
    strategy: 'experiment',
    source: { type: 'market_intelligence', name: 'Growth Core', externalId: item.id },
    evidence: [
      {
        type: 'market',
        summary: item.rationale,
        confidence,
      },
    ],
    economics: {
      currency: 'USD',
      estimatedRevenue: { min: Math.max(item.expectedValue, 0), max: Math.max(item.expectedValue, 0) },
      paymentLikelihood: confidence,
    },
    score: {
      total: Math.max(0, Math.min(100, item.score)),
      demand: Math.max(0, Math.min(100, item.score)),
      buyerValue: Math.max(0, Math.min(100, item.score)),
      distributionPotential: Math.max(0, Math.min(100, item.score)),
      aiLeverage: 50,
      recurringRevenue: 50,
      competition: 50,
      startupCost: 50,
      operationalComplexity: 50,
      regulatoryRisk: 50,
      evidenceConfidence: confidence * 100,
      personalFit: 50,
      recommendation: item.action === 'scale' ? 'pursue' : item.action === 'stop' ? 'reject' : 'test',
    },
    status: 'discovered',
    requiresApproval: true,
    createdAt: now,
    updatedAt: now,
  }
}

export function adaptGrowthOpportunities(items: readonly GrowthOpportunity[], userId: string): Opportunity[] {
  return items.map((item) => adaptGrowthOpportunity(item, userId))
}
