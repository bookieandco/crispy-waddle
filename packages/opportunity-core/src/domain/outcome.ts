import type { Opportunity } from './opportunity.js'

export type OpportunityOutcomeResult = 'won' | 'lost'
export type OpportunityOutcomeSourceOwner =
  | 'money_core'
  | 'commerce'
  | 'placement'
  | 'overageos'
  | 'growth'
  | 'user'

export type OpportunityOutcomeObservationInput = {
  id: string
  opportunityId: string
  result: OpportunityOutcomeResult
  currency: string
  grossRevenue: number
  refunds?: number
  directCosts: number
  fees?: number
  hours: number
  sourceOwner: OpportunityOutcomeSourceOwner
  evidenceRefs: string[]
  transactionRefs?: string[]
  actionRef?: string
  executionRef?: string
  observedAt: string
  notes?: string
}

export type OpportunityOutcome = OpportunityOutcomeObservationInput & {
  refunds: number
  fees: number
  netRevenue: number
  totalCosts: number
  profit: number
  margin: number | null
  dollarsPerHour: number | null
}

export type OpportunityLearningSignal = {
  id: string
  opportunityId: string
  family: Opportunity['family']
  type: Opportunity['type']
  providerId?: string
  result: OpportunityOutcomeResult
  currency: string
  grossRevenue: number
  netRevenue: number
  totalCosts: number
  profit: number
  margin: number | null
  hours: number
  dollarsPerHour: number | null
  sourceOwner: OpportunityOutcomeSourceOwner
  evidenceRefs: string[]
  transactionRefs: string[]
  observedAt: string
}

export function calculateOpportunityOutcome(input: OpportunityOutcomeObservationInput): OpportunityOutcome {
  assertNonNegative(input.grossRevenue, 'grossRevenue')
  assertNonNegative(input.directCosts, 'directCosts')
  assertNonNegative(input.refunds ?? 0, 'refunds')
  assertNonNegative(input.fees ?? 0, 'fees')
  assertNonNegative(input.hours, 'hours')
  if (!input.id.trim()) throw new Error('outcome id is required')
  if (!input.opportunityId.trim()) throw new Error('opportunityId is required')
  if (!input.currency.trim()) throw new Error('currency is required')
  if (!input.observedAt.trim()) throw new Error('observedAt is required')
  if (input.evidenceRefs.length === 0) throw new Error('realized outcome requires evidence')

  const refunds = input.refunds ?? 0
  const fees = input.fees ?? 0
  const netRevenue = input.grossRevenue - refunds
  const totalCosts = input.directCosts + fees
  const profit = netRevenue - totalCosts
  const margin = netRevenue > 0 ? profit / netRevenue : null
  const dollarsPerHour = input.hours > 0 ? profit / input.hours : null

  return {
    ...input,
    refunds,
    fees,
    netRevenue,
    totalCosts,
    profit,
    margin,
    dollarsPerHour,
  }
}

export function buildOpportunityLearningSignal(
  opportunity: Opportunity,
  outcome: OpportunityOutcome,
): OpportunityLearningSignal {
  if (outcome.opportunityId !== opportunity.id) throw new Error('Outcome does not belong to opportunity')
  const providerId = typeof opportunity.metadata?.providerId === 'string'
    ? opportunity.metadata.providerId
    : undefined

  return {
    id: `learning:${outcome.id}`,
    opportunityId: opportunity.id,
    family: opportunity.family,
    type: opportunity.type,
    providerId,
    result: outcome.result,
    currency: outcome.currency,
    grossRevenue: outcome.grossRevenue,
    netRevenue: outcome.netRevenue,
    totalCosts: outcome.totalCosts,
    profit: outcome.profit,
    margin: outcome.margin,
    hours: outcome.hours,
    dollarsPerHour: outcome.dollarsPerHour,
    sourceOwner: outcome.sourceOwner,
    evidenceRefs: [...outcome.evidenceRefs],
    transactionRefs: [...(outcome.transactionRefs ?? [])],
    observedAt: outcome.observedAt,
  }
}

export function applyOpportunityOutcome(
  opportunity: Opportunity,
  outcome: OpportunityOutcome,
  now = new Date().toISOString(),
): Opportunity {
  if (outcome.opportunityId !== opportunity.id) throw new Error('Outcome does not belong to opportunity')
  if (!['ready', 'approved', 'pursuing', 'won', 'lost'].includes(opportunity.status)) {
    throw new Error(`Opportunity cannot record a realized outcome from status ${opportunity.status}`)
  }
  if ((opportunity.status === 'won' || opportunity.status === 'lost') && opportunity.status !== outcome.result) {
    throw new Error('A closed opportunity cannot be rewritten to the opposite result')
  }
  return {
    ...opportunity,
    status: outcome.result,
    metadata: {
      ...opportunity.metadata,
      lastOutcomeId: outcome.id,
      realizedProfit: outcome.profit,
      realizedMargin: outcome.margin,
      realizedDollarsPerHour: outcome.dollarsPerHour,
    },
    updatedAt: now,
  }
}

function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative number`)
}
