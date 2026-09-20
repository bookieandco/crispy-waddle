import { adaptCommercialOpportunity } from '../adapters/commercial.js'
import { applyOpportunityOutcome, buildOpportunityLearningSignal, calculateOpportunityOutcome } from './outcome.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const opportunity = adaptCommercialOpportunity({
  providerId: 'provider:growth-affiliate',
  externalId: 'offer-1',
  kind: 'affiliate',
  title: 'Affiliate fixture',
  sourceUrl: 'https://example.test/offer',
  sourceName: 'Fixture source',
})

const outcome = calculateOpportunityOutcome({
  id: 'outcome:offer-1',
  opportunityId: opportunity.id,
  result: 'won',
  currency: 'USD',
  grossRevenue: 1000,
  refunds: 100,
  directCosts: 300,
  fees: 50,
  hours: 10,
  sourceOwner: 'money_core',
  evidenceRefs: ['ledger:revenue', 'ledger:costs'],
  transactionRefs: ['txn:1'],
  observedAt: '2026-09-19T12:00:00Z',
})
assert(outcome.netRevenue === 900, 'Net revenue must subtract refunds')
assert(outcome.totalCosts === 350, 'Total costs must include direct costs and fees')
assert(outcome.profit === 550, 'Profit must be deterministic')
assert(outcome.margin === 550 / 900, 'Margin must use net revenue')
assert(outcome.dollarsPerHour === 55, 'Dollars per hour must use realized profit')

const signal = buildOpportunityLearningSignal(opportunity, outcome)
assert(signal.providerId === 'provider:growth-affiliate', 'Learning must preserve provider attribution')
assert(signal.evidenceRefs.length === 2, 'Learning must preserve financial evidence lineage')

const closed = applyOpportunityOutcome({ ...opportunity, status: 'ready' }, outcome, '2026-09-19T13:00:00Z')
assert(closed.status === 'won', 'Won outcome must close canonical opportunity as won')
assert(closed.metadata?.realizedProfit === 550, 'Canonical opportunity must expose realized learning metrics')

let evidenceRequired = false
try {
  calculateOpportunityOutcome({
    id: 'outcome:no-evidence',
    opportunityId: opportunity.id,
    result: 'lost',
    currency: 'USD',
    grossRevenue: 0,
    directCosts: 0,
    hours: 1,
    sourceOwner: 'user',
    evidenceRefs: [],
    observedAt: '2026-09-19T12:00:00Z',
  })
} catch {
  evidenceRequired = true
}
assert(evidenceRequired, 'Outcome truth must not be recorded without evidence')


let prematureBlocked = false
try {
  applyOpportunityOutcome(opportunity, outcome, '2026-09-19T13:00:00Z')
} catch {
  prematureBlocked = true
}
assert(prematureBlocked, 'Premature outcome recording must be blocked before the opportunity is ready/pursuing')
