import type { Opportunity as LegacyOpportunity } from './sideIncome.js'
import type { Opportunity, OpportunitySourceType } from '@jhadina/growth-core'

const sourceTypeFor = (kind: LegacyOpportunity['kind']): OpportunitySourceType => {
  if (kind === 'affiliate') return 'affiliate'
  if (kind === 'dropshipping') return 'ecommerce'
  if (kind === 'overage') return 'overage'
  if (kind === 'creator') return 'content'
  if (kind === 'freelance' || kind === 'remote_gig' || kind === 'ai_job') return 'service'
  return 'market_intelligence'
}

const strategyFor = (kind: LegacyOpportunity['kind']): Opportunity['strategy'] => {
  if (kind === 'affiliate') return 'affiliate'
  if (kind === 'dropshipping') return 'ecommerce'
  if (kind === 'creator') return 'media'
  if (kind === 'automation' || kind === 'ai_job') return 'service'
  if (kind === 'freelance' || kind === 'remote_gig') return 'service'
  if (kind === 'overage') return 'experiment'
  return 'experiment'
}

export function adaptLegacyOpportunity(item: LegacyOpportunity): Opportunity {
  const now = new Date().toISOString()
  return {
    id: item.id,
    userId: item.userId,
    title: item.title,
    description: item.summary,
    class: item.kind === 'freelance' || item.kind === 'remote_gig' || item.kind === 'ai_job' ? 'freelance' : 'experiment',
    strategy: strategyFor(item.kind),
    source: { type: sourceTypeFor(item.kind), name: item.sourceName, url: item.sourceUrl },
    buyer: undefined,
    problem: undefined,
    evidence: [{ type: 'source', summary: item.summary, sourceUrl: item.sourceUrl, confidence: item.sourceConfidence ?? 50 }],
    economics: {
      currency: item.estimatedPay?.currency ?? 'USD',
      estimatedRevenue: item.estimatedPay ? { min: item.estimatedPay.min, max: item.estimatedPay.max } : undefined,
      startupCost: item.startupCost,
      estimatedHours: item.estimatedHours,
      paymentLikelihood: item.sourceConfidence,
    },
    status: item.status === 'approved' ? 'approved' : 'discovered',
    deadline: item.deadline,
    requiresApproval: item.requiresUserApproval,
    createdAt: item.createdAt,
    updatedAt: item.approvedAt ?? now,
  }
}

export const adaptLegacyOpportunities = (items: LegacyOpportunity[]): Opportunity[] => items.map(adaptLegacyOpportunity)
