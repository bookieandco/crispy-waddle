import assert from 'node:assert/strict'
import test from 'node:test'
import { toSharkFundamentalInput } from './shark-fundamental-adapter.js'
import type { FundamentalState } from './issuer-reality-contracts.js'

const state: FundamentalState = {
  stateId: 'fundamental-state-1',
  issuerId: 'issuer-1',
  informationCutoff: '2026-02-20T12:30:00Z',
  factIds: ['fact-1'],
  status: 'DATA_COMPLETE',
  derivedAt: '2026-02-20T12:31:00Z',
  methodologyVersion: '035.1',
  inputSnapshotHash: 'snapshot-hash',
  evidenceRefs: [{
    evidenceId: 'evidence-1',
    sourceId: 'sec',
    observedAt: '2026-02-20T12:00:00Z',
    receivedAt: '2026-02-20T12:01:00Z',
    quality: 'VERIFIED',
    inputHash: 'input-hash',
  }],
  provenanceHash: 'state-hash',
}

test('adapts fundamental state without creating prediction or execution authority', () => {
  const input = toSharkFundamentalInput(state, 'instrument-1')
  assert.equal(input.issuerId, 'issuer-1')
  assert.equal(input.instrumentId, 'instrument-1')
  assert.equal(input.informationCutoff, state.informationCutoff)
  assert.deepEqual(input.factIds, ['fact-1'])
  assert.equal(input.inputSnapshotHash, 'snapshot-hash')
})

test('rejects an unresolved instrument boundary', () => {
  assert.throws(() => toSharkFundamentalInput(state, ''))
})
