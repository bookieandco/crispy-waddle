import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertIssuerIdentifier,
  assertIssuerInstrumentRelationship,
  assertPointInTimeFact,
  buildFundamentalState,
  factWasAvailableAt,
  relationshipWasEffectiveAt,
  revisionsForFact,
  selectActiveFactsAtCutoff,
  selectFactsAtCutoff,
  selectIssuerIdentifiersAt,
  selectIssuerInstrumentRelationshipsAt,
  toSharkFundamentalInput,
  type FactRevision,
  type FinancialFact,
  type IssuerIdentifier,
  type IssuerInstrumentRelationship,
} from './issuer-reality-contracts.js'

const fact = (overrides: Partial<FinancialFact> = {}): FinancialFact => ({
  factId: 'fact-1', issuerId: 'issuer-1', filingId: 'filing-1', taxonomy: 'us-gaap', concept: 'Revenue', value: { coefficient: 1000n, scale: 2, currency: 'USD', unit: 'USD' }, dimensions: [],
  reportedAt: '2026-02-20T12:00:00Z', availableAt: '2026-02-20T12:00:00Z', receivedAt: '2026-02-20T12:01:00Z', status: 'REPORTED', evidenceRefs: [], provenanceHash: 'hash-1', ...overrides,
})
const revision = (overrides: Partial<FactRevision> = {}): FactRevision => ({ revisionId: 'revision-1', factId: 'fact-1', revisionType: 'RESTATEMENT', revisedAt: '2026-03-10T12:00:00Z', evidenceRefs: [], provenanceHash: 'revision-hash', ...overrides })
const relation = (overrides: Partial<IssuerInstrumentRelationship> = {}): IssuerInstrumentRelationship => ({ relationshipId: 'rel-1', issuerId: 'issuer-1', instrumentId: 'instrument-1', relationshipType: 'ISSUER_OF', effectiveAt: '2026-01-01T00:00:00Z', evidenceRefs: [], provenanceHash: 'rel-hash', ...overrides })
const identifier = (overrides: Partial<IssuerIdentifier> = {}): IssuerIdentifier => ({ identifierId: 'id-1', issuerId: 'issuer-1', type: 'CIK', value: '0001234567', effectiveAt: '2026-01-01T00:00:00Z', evidenceRefs: [], provenanceHash: 'id-hash', ...overrides })

const build = (facts: readonly FinancialFact[], revisions: readonly FactRevision[] = [], cutoff = '2026-02-25T00:00:00Z') => buildFundamentalState('issuer-1', facts, revisions, cutoff, '2026-03-02T00:00:00Z', '035.1', `snapshot-${cutoff}`, [], `state-hash-${cutoff}`)

test('rejects facts whose availability predates reporting', () => assert.throws(() => assertPointInTimeFact(fact({ availableAt: '2026-02-19T12:00:00Z' })), /availableAt cannot precede reportedAt/))
test('rejects facts received before they were available', () => assert.throws(() => assertPointInTimeFact(fact({ receivedAt: '2026-02-20T11:59:00Z' })), /receivedAt cannot precede availableAt/))
test('does not leak a future filing into an earlier cutoff', () => {
  const historical = fact(); const future = fact({ factId: 'fact-2', availableAt: '2026-02-21T12:00:00Z' }); const selected = selectFactsAtCutoff([historical, future], '2026-02-20T12:30:00Z')
  assert.deepEqual(selected.map((item) => item.factId), ['fact-1']); assert.equal(factWasAvailableAt(future, '2026-02-20T12:30:00Z'), false)
})
test('allows a fact at the exact information cutoff', () => assert.equal(factWasAvailableAt(fact(), '2026-02-20T12:00:00Z'), true))
test('builds different immutable fundamental states at different information cutoffs', () => {
  const later = fact({ factId: 'fact-2', filingId: 'filing-2', concept: 'NetIncome', availableAt: '2026-03-01T12:00:00Z' }); const earlyState = build([fact(), later]); const lateState = build([fact(), later], [], '2026-03-02T00:00:00Z')
  assert.deepEqual(earlyState.factIds, ['fact-1']); assert.deepEqual(lateState.factIds, ['fact-1', 'fact-2']); assert.notEqual(earlyState.stateId, lateState.stateId)
})
test('SHARK input cannot acquire a fact after the state cutoff', () => {
  const later = fact({ factId: 'fact-2', filingId: 'filing-2', availableAt: '2026-03-01T12:00:00Z' }); const state = build([fact(), later]); const input = toSharkFundamentalInput(state, 'instrument-1', [fact(), later])
  assert.deepEqual(input.factIds, ['fact-1']); assert.equal(input.instrumentId, 'instrument-1'); assert.equal(input.informationCutoff, state.informationCutoff)
})
test('keeps restatements append-only and preserves the original fact', () => {
  const original = fact(); const restated = fact({ factId: 'fact-2', value: { coefficient: 1200n, scale: 2, currency: 'USD', unit: 'USD' }, status: 'RESTATED', availableAt: '2026-03-10T12:00:00Z', filingId: 'filing-2' }); const chain = [revision({ supersedesFactId: 'fact-1' })]
  assert.equal((original.value as { coefficient: bigint }).coefficient, 1000n); assert.deepEqual(revisionsForFact(chain, 'fact-1').map((item) => item.revisionId), ['revision-1']); assert.deepEqual(selectFactsAtCutoff([original, restated], '2026-03-05T00:00:00Z').map((item) => item.factId), ['fact-1']); assert.deepEqual(selectFactsAtCutoff([original, restated], '2026-03-11T00:00:00Z').map((item) => item.factId), ['fact-1', 'fact-2'])
})
test('withdrawal removes a fact only from the active projection, not history', () => {
  const original = fact(); const withdrawal = revision({ revisionType: 'WITHDRAWAL', revisedAt: '2026-03-10T12:00:00Z' }); assert.deepEqual(selectActiveFactsAtCutoff([original], [], '2026-03-05T00:00:00Z').map((item) => item.factId), ['fact-1']); assert.deepEqual(selectActiveFactsAtCutoff([original], [withdrawal], '2026-03-11T00:00:00Z'), []); assert.deepEqual(selectFactsAtCutoff([original], '2026-03-11T00:00:00Z').map((item) => item.factId), ['fact-1'])
})
test('fundamental state consumes the revision ledger and carries revision evidence', () => {
  const restatement = revision(); const state = build([fact()], [restatement], '2026-03-11T00:00:00Z'); assert.equal(state.status, 'RESTATEMENT_PENDING'); assert.equal(state.evidenceRefs.length, 0)
})
test('issuer identifiers are canonical and point-in-time', () => {
  const oldId = identifier({ identifierId: 'old', value: '0001111111', expiresAt: '2026-06-01T00:00:00Z' }); const newId = identifier({ identifierId: 'new', value: '0002222222', effectiveAt: '2026-06-01T00:00:00Z' });
  assert.deepEqual(selectIssuerIdentifiersAt([oldId, newId], 'issuer-1', '2026-05-31T23:59:59Z').map((item) => item.identifierId), ['old']); assert.deepEqual(selectIssuerIdentifiersAt([oldId, newId], 'issuer-1', '2026-06-01T00:00:00Z').map((item) => item.identifierId), ['new'])
})
test('rejects inverted issuer identifier windows', () => assert.throws(() => assertIssuerIdentifier(identifier({ effectiveAt: '2026-06-02T00:00:00Z', expiresAt: '2026-06-01T00:00:00Z' })), /expiresAt cannot precede effectiveAt/))
test('symbol changes do not create a new instrument identity', () => {
  const relationships = [relation({ relationshipId: 'symbol-old', effectiveAt: '2026-01-01T00:00:00Z', expiresAt: '2026-06-01T00:00:00Z' }), relation({ relationshipId: 'symbol-new', effectiveAt: '2026-06-01T00:00:00Z' })]
  assert.deepEqual(selectIssuerInstrumentRelationshipsAt(relationships, 'issuer-1', 'instrument-1', '2026-05-31T23:59:59Z').map((item) => item.relationshipId), ['symbol-old']); assert.deepEqual(selectIssuerInstrumentRelationshipsAt(relationships, 'issuer-1', 'instrument-1', '2026-06-01T00:00:00Z').map((item) => item.relationshipId), ['symbol-new'])
})
test('issuer successor can inherit a security relationship without rewriting historical issuer identity', () => {
  const successor = relation({ relationshipId: 'successor', issuerId: 'issuer-2', instrumentId: 'instrument-1', relationshipType: 'SUCCESSOR_SECURITY', effectiveAt: '2026-06-15T00:00:00Z' }); assert.equal(relationshipWasEffectiveAt(successor, '2026-06-14T23:59:59Z'), false); assert.equal(relationshipWasEffectiveAt(successor, '2026-06-15T00:00:00Z'), true)
})
test('rejects inverted issuer-instrument relationship windows', () => assert.throws(() => assertIssuerInstrumentRelationship(relation({ effectiveAt: '2026-06-02T00:00:00Z', expiresAt: '2026-06-01T00:00:00Z' })), /expiresAt cannot precede effectiveAt/))
