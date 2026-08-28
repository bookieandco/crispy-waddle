import type { Opportunity } from '@/lib/opportunities/sideIncome'
import type { MoneyActionItem } from '@/lib/money-opportunities/action-queue'
import { buildResearchCasePlan, persistResearchCasePlan, type ResearchCasePlan, type ResearchPersistence } from '@/lib/opportunities/research'
import type { CorporateOpportunityLead } from './corporate-opportunity-leads'

export interface CorporateLeadResearchBridgeOptions { minimumScore: number; now?: string }
export interface CorporateLeadResearchBridgeResult { routed: boolean; reason: 'BELOW_THRESHOLD' | 'ROUTED'; plan?: ResearchCasePlan }

/** Routes a scored corporate lead into the existing research boundary without executing an action. */
export async function routeCorporateLeadToResearch(lead: CorporateOpportunityLead, opportunity: Opportunity, action: MoneyActionItem, persistence: ResearchPersistence, options: CorporateLeadResearchBridgeOptions): Promise<CorporateLeadResearchBridgeResult> {
  if (!lead.opportunityId || !lead.entityId) throw new Error('lead opportunityId and entityId are required')
  if (lead.opportunityId !== opportunity.id) throw new Error('lead and opportunity IDs must match')
  if (options.minimumScore < 0 || options.minimumScore > 100) throw new Error('minimumScore must be between 0 and 100')
  if (lead.score < options.minimumScore) return { routed: false, reason: 'BELOW_THRESHOLD' }
  const plan = buildResearchCasePlan(opportunity, action, options.now)
  await persistResearchCasePlan(persistence, plan)
  return { routed: true, reason: 'ROUTED', plan }
}
