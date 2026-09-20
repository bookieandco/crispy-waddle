import type {
  OpportunityOutcomeObservationInput,
  OpportunityOutcomeResult,
} from '@jhadina/opportunity-core'

export type MoneyOpportunityActuals = {
  outcomeId: string
  opportunityId: string
  result: OpportunityOutcomeResult
  currency: string
  grossRevenue: number
  refunds?: number
  directCosts: number
  fees?: number
  hours: number
  evidenceRefs: string[]
  transactionRefs?: string[]
  actionRef?: string
  executionRef?: string
  observedAt: string
  notes?: string
}

/**
 * Money Core is the financial-truth producer. This bridge does not calculate
 * opportunity rank or execute anything; it only packages reconciled actuals
 * for Opportunity Core's realized-outcome ledger.
 */
export function toOpportunityOutcomeObservation(
  actuals: MoneyOpportunityActuals,
): OpportunityOutcomeObservationInput {
  if (!actuals.outcomeId.trim()) throw new Error('outcomeId is required')
  if (!actuals.opportunityId.trim()) throw new Error('opportunityId is required')
  if (!actuals.currency.trim()) throw new Error('currency is required')
  if (!actuals.observedAt.trim()) throw new Error('observedAt is required')
  if (actuals.evidenceRefs.length === 0) throw new Error('Money outcome actuals require evidence')
  assertNonNegative(actuals.grossRevenue, 'grossRevenue')
  assertNonNegative(actuals.refunds ?? 0, 'refunds')
  assertNonNegative(actuals.directCosts, 'directCosts')
  assertNonNegative(actuals.fees ?? 0, 'fees')
  assertNonNegative(actuals.hours, 'hours')

  return {
    id: actuals.outcomeId,
    opportunityId: actuals.opportunityId,
    result: actuals.result,
    currency: actuals.currency,
    grossRevenue: actuals.grossRevenue,
    refunds: actuals.refunds,
    directCosts: actuals.directCosts,
    fees: actuals.fees,
    hours: actuals.hours,
    sourceOwner: 'money_core',
    evidenceRefs: [...actuals.evidenceRefs],
    transactionRefs: [...(actuals.transactionRefs ?? [])],
    actionRef: actuals.actionRef,
    executionRef: actuals.executionRef,
    observedAt: actuals.observedAt,
    notes: actuals.notes,
  }
}

function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite non-negative number`)
  }
}
