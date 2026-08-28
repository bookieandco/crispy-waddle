import type { Opportunity as LegacyOpportunity } from '../../../../apps/jhadina-web/src/lib/opportunities/sideIncome.js'
import type { Opportunity, OpportunitySourceType } from '../domain/opportunity.js'

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

export function adaptSideIncomeOpportunity(item: LegacyOpportunity): Opportunity {
  const now = new Date().toISOString()
  const sourceType = sourceTypeFor(item.kind)

  return {
    id: item.id,
    userId: item.userId,
    title: item.title,
    description: item.summary,
    class: item.kind === 'freelance' || item.kind === 'remote_gig' || item.kind === 'ai_job' ? 'freelance' : 'experiment',
    strategy: strategyFor(item.kind),
    source: {
      type: sourceType,
      name: item.sourceName,
      url: item.sourceUrl,
    },
    economics: {
      currency: item.estimatedPay?.currency ?? 'USD',
      estimatedRevenue: item.estimatedPay
        ? { min: item.estimatedPay.min, max: item.estimatedPay.max }
        : undefined,
      startupCost: item.startupCost,
      estimatedHours: item.estimatedHours,
      paymentLikelihood: item.sourceConfidence,
    },
    evidence: [
      {
        type: 'source',
        summary: item.summary,
        sourceUrl: item.sourceUrl,
        confidence: item.sourceConfidence ?? 50,
      },
    ],
    status: item.status === 'approved' ? 'approved' : 'discovered',
    deadline: item.deadline,
    requiresApproval: item.requiresUserApproval,
    createdAt: item.createdAt,
    updatedAt: item.approvedAt ?? now,
  }
}

export function adaptSideIncomeOpportunities(items: LegacyOpportunity[]): Opportunity[] {
  return items.map(adaptSideIncomeOpportunity)
}
