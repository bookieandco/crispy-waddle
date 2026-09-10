import assert from 'node:assert/strict'
import test from 'node:test'
import type { FinancialFact, FundamentalState } from './issuer-reality-contracts.js'
import { assertNormalizedMetric, buildTtmMetric, normalizeReportedFact } from './fundamental-normalization-contracts.js'

const fact = (id = 'fact-1', availableAt = '2026-02-20T12:00:00Z'): FinancialFact => ({ factId: id, issuerId: 'issuer-1', filingId: 'filing-1', taxonomy: 'us-gaap', concept: 'Revenue', value: { coefficient: 1000n, scale: 0, currency: 'USD', unit: 'USD' }, dimensions: [], reportedAt: '2026-02-20T11:00:00Z', availableAt, receivedAt: '2026-02-20T12:01:00Z', status: 'REPORTED', evidenceRefs: [], provenanceHash: `hash-${id}` })
const state = (factIds: readonly string[] = ['fact-1']): FundamentalState => ({ stateId: 'state-1', issuerId: 'issuer-1', informationCutoff: '2026-02-25T00:00:00Z', factIds, status: 'DATA_COMPLETE', derivedAt: '2026-03-01T00:00:00Z', methodologyVersion: '035.1', inputSnapshotHash: 'snapshot-1', evidenceRefs: [], provenanceHash: 'state-hash' })
const value = { coefficient: 1000n, scale: 0, currency: 'USD', unit: 'USD' } as const

test('normalized metrics preserve source state and cannot masquerade as reported facts', () => {
  const metric = normalizeReportedFact(fact(), state(), 'revenue', value, '036.1', ['rule-1'], 'snapshot-036', [], 'metric-hash')
  assert.equal(metric.treatment, 'NORMALIZED')
  assert.deepEqual(metric.sourceFactIds, ['fact-1'])
  assert.equal(metric.sourceStateId, 'state-1')
  assert.doesNotThrow(() => assertNormalizedMetric(metric))
  assert.throws(() => assertNormalizedMetric({ ...metric, treatment: 'REPORTED' }))
})

test('normalization rejects facts outside the canonical fundamental state', () => {
  assert.throws(() => normalizeReportedFact(fact('future', '2026-03-01T00:00:00Z'), state(), 'revenue', value, '036.1', [], 'snapshot', [], 'hash'))
  assert.throws(() => normalizeReportedFact(fact('other'), state([]), 'revenue', value, '036.1', [], 'snapshot', [], 'hash'))
})

test('TTM rejects empty or future contributions', () => {
  assert.throws(() => buildTtmMetric('issuer-1', 'revenue', [], state(), value, '036.1', [], 'hash'))
  assert.throws(() => buildTtmMetric('issuer-1', 'revenue', [fact('future', '2026-03-01T00:00:00Z')], state(['future']), value, '036.1', [], 'hash'))
})

test('TTM remains a derived artifact tied to its contributing facts and cutoff', () => {
  const metric = buildTtmMetric('issuer-1', 'revenue', [fact()], state(), value, '036.1', [], 'ttm-hash')
  assert.deepEqual(metric.contributingFactIds, ['fact-1'])
  assert.equal(metric.informationCutoff, '2026-02-25T00:00:00Z')
  assert.equal(metric.methodologyVersion, '036.1')
  assert.equal(metric.status, 'VALID')
})
