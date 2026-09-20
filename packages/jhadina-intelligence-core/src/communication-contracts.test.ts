import assert from 'node:assert/strict'
import test from 'node:test'
import { assertCommunicationIntent } from './communication-contracts.js'

const base = {
  intentId: 'intent-1',
  correlationId: 'corr-1',
  actorId: 'actor-1',
  recipient: { endpointId: 'person-1', kind: 'person' as const, trustState: 'trusted', authorization: { capability: 'communications.send', granted: true, evidenceRef: 'grant:1' } as const },
  capability: 'communications.send' as const,
  contentRef: 'content:1',
  createdAt: '2026-09-19T00:00:00.000Z',
}

test('authorized endpoint may form a communication intent without selecting transport', () => {
  const intent = assertCommunicationIntent(base)
  assert.equal(intent.recipient.endpointId, 'person-1')
  assert.equal('transportId' in intent, false)
})

test('discovery, reachability, identification and trust do not equal authorization', () => {
  for (const trustState of ['discovered', 'reachable', 'identified', 'trusted'] as const) {
    assert.throws(() => assertCommunicationIntent({ ...base, recipient: { ...base.recipient, trustState } }), /RECIPIENT_NOT_AUTHORIZED/)
  }
})
