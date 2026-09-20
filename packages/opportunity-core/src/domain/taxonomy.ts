import type { Opportunity } from './opportunity.js'

export type OpportunityHubCategory =
  | 'earn'
  | 'freelance'
  | 'products'
  | 'arbitrage'
  | 'ai_businesses'
  | 'partnerships'
  | 'assets'
  | 'experiments'

export type OpportunityExperimentPlan = {
  opportunityId: string
  disposition: 'TEST'
  evidenceRefs: string[]
  assumptions: string[]
  downside: string[]
  budgetCap: number
  currency: string
  timeCapHours: number
  measurement: {
    primaryMetric: string
    successThreshold: string
    stopConditions: string[]
  }
}

export function classifyOpportunityHubCategory(opportunity: Opportunity): OpportunityHubCategory {
  const explicit = opportunity.metadata?.hubCategory
  if (isCategory(explicit)) return explicit

  if (opportunity.metadata?.experimental === true || opportunity.metadata?.providerId === 'provider:energy-compute') return 'experiments'
  if (opportunity.metadata?.providerId === 'provider:information-broker') return 'arbitrage'
  if (opportunity.metadata?.requiresPartner === true || opportunity.metadata?.capabilityGap === true) return 'partnerships'

  const kind = opportunity.metadata?.opportunityKind
  if (kind === 'freelance' || kind === 'remote_gig' || opportunity.type === 'gig') return 'freelance'
  if (kind === 'pod' || kind === 'dropshipping' || kind === 'affiliate' || opportunity.family === 'commerce') return 'products'
  if (kind === 'ai_job' || opportunity.type === 'job') return 'earn'
  if (opportunity.family === 'real_estate' || opportunity.family === 'recovery') return 'assets'
  if (opportunity.family === 'creator' || kind === 'creator' || opportunity.metadata?.commercialKind === 'service' || kind === 'automation') return 'ai_businesses'
  return 'earn'
}

export function validateExperimentPlan(plan: OpportunityExperimentPlan): void {
  if (plan.disposition !== 'TEST') throw new Error('Experimental opportunities must be labeled TEST')
  if (plan.evidenceRefs.length === 0) throw new Error('Experiment requires evidence references')
  if (plan.assumptions.length === 0) throw new Error('Experiment requires explicit assumptions')
  if (plan.downside.length === 0) throw new Error('Experiment requires explicit downside')
  if (!Number.isFinite(plan.budgetCap) || plan.budgetCap < 0) throw new Error('Experiment budget cap must be finite and non-negative')
  if (!plan.currency.trim()) throw new Error('Experiment currency is required')
  if (!Number.isFinite(plan.timeCapHours) || plan.timeCapHours <= 0) throw new Error('Experiment time cap must be greater than zero')
  if (!plan.measurement.primaryMetric.trim()) throw new Error('Experiment primary metric is required')
  if (!plan.measurement.successThreshold.trim()) throw new Error('Experiment success threshold is required')
  if (plan.measurement.stopConditions.length === 0) throw new Error('Experiment requires stop conditions')
}

function isCategory(value: unknown): value is OpportunityHubCategory {
  return typeof value === 'string' &&
    ['earn','freelance','products','arbitrage','ai_businesses','partnerships','assets','experiments'].includes(value)
}
