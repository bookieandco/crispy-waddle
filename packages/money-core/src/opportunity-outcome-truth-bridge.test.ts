import test from 'node:test'
import assert from 'node:assert/strict'
import { toOpportunityOutcomeObservation } from './opportunity-outcome-truth-bridge.js'

test('Money Core emits evidence-backed Opportunity outcome actuals', () => {
  const observation = toOpportunityOutcomeObservation({
    outcomeId: 'outcome:1',
    opportunityId: 'commercial:provider:growth-affiliate:offer-1',
    result: 'won',
    currency: 'USD',
    grossRevenue: 1000,
    directCosts: 250,
    fees: 25,
    refunds: 50,
    hours: 10,
    evidenceRefs: ['ledger:revenue', 'ledger:cost'],
    transactionRefs: ['txn:1'],
    observedAt: '2026-09-19T12:00:00Z',
  })

  assert.equal(observation.sourceOwner, 'money_core')
  assert.deepEqual(observation.transactionRefs, ['txn:1'])
  assert.equal(observation.evidenceRefs.length, 2)
})

test('Money Core refuses unevidenced realized actuals', () => {
  assert.throws(() => toOpportunityOutcomeObservation({
    outcomeId: 'outcome:2',
    opportunityId: 'opportunity:2',
    result: 'lost',
    currency: 'USD',
    grossRevenue: 0,
    directCosts: 0,
    hours: 1,
    evidenceRefs: [],
    observedAt: '2026-09-19T12:00:00Z',
  }), /require evidence/)
})
