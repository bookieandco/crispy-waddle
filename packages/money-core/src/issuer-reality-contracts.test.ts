import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertPointInTimeFact,
  factWasAvailableAt,
  selectFactsAtCutoff,
  type FinancialFact,
} from './issuer-reality-contracts.js'

const fact = (overrides: Partial<FinancialFact> = {}): FinancialFact => ({
  factId: 'fact-1',
  issuerId: 'issuer-1',
  filingId: 'filing-1',
  taxonomy: 'us-gaap',
  concept: 'Revenue',
  value: { coefficient: 1000n, scale: 2, currency: 'USD', unit: 'USD' },
  dimensions: [],
  reportedAt: '2026-02-20T12:00:00Z',
  availableAt: '2026-02-20T12:00:00Z',
  receivedAt: '2026-02-20T12:01:00Z',
  status: 'REPORTED',
  evidenceRefs: ['evidence-1'],
  provenanceHash: 'hash-1',
  ...overrides,
})

test('rejects facts whose availability predates reporting', () => {
  assert.throws(() => assertPointInTimeFact(fact({ availableAt: '2026-02-19T12:00:00Z' })), /availableAt cannot precede reportedAt/)
})

test('rejects facts received before they were available', () => {
  assert.throws(() => assertPointInTimeFact(fact({ receivedAt: '2026-02-20T11:59:00Z' })), /receivedAt cannot precede availableAt/)
})

test('does not leak a future filing into an earlier cutoff', () => {
  const historical = fact()
  const future = fact({ factId: 'fact-2', availableAt: '2026-02-21T12:00:00Z' })
  const selected = selectFactsAtCutoff([historical, future], '2026-02-20T12:30:00Z')
  assert.deepEqual(selected.map((item) => item.factId), ['fact-1'])
  assert.equal(factWasAvailableAt(future, '2026-02-20T12:30:00Z'), false)
})

test('allows a fact at the exact information cutoff', () => {
  assert.equal(factWasAvailableAt(fact(), '2026-02-20T12:00:00Z'), true)
})
