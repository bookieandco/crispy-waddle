import assert from 'node:assert/strict'
import test from 'node:test'
import { assertCommunicationIntent } from './communication-contracts.js'

const base = {
  intentId: 'intent-1',
  correlationId: 'corr-1',
  actorId: 'actor-1',
  recipient: { endpointId: 'person-1', kind: 'person' as const, trustState: 'trusted' as const, authorization: { capability: 'communications.send' as const, granted: true, evidenceRef: 'grant:1' } },
  capability: 'communications.send' as const,
  contentRef: 'content:1',
  createdAt: '2026-09-19T00:00:00.000Z',
}

test('explicit authorization may form a communication intent without selecting transport', () => {
  const intent = assertCommunicationIntent(base)
  assert.equal(intent.recipient.endpointId, 'person-1')
  assert.equal('transportId' in intent, false)
})

test('trust state never grants or revokes independent authorization', () => {
  for (const trustState of ['discovered', 'reachable', 'identified', 'trusted'] as const) {
    assert.doesNotThrow(() => assertCommunicationIntent({ ...base, recipient: { ...base.recipient, trustState } }))
  }
  assert.throws(() => assertCommunicationIntent({ ...base, recipient: { ...base.recipient, authorization: { ...base.recipient.authorization, granted: false } } }), /RECIPIENT_NOT_AUTHORIZED/)
  assert.throws(() => assertCommunicationIntent({ ...base, recipient: { ...base.recipient, authorization: { ...base.recipient.authorization, evidenceRef: '' } } }), /RECIPIENT_NOT_AUTHORIZED/)
})
