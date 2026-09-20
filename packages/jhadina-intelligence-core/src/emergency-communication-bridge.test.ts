import assert from 'node:assert/strict';
import test from 'node:test';
import { GovernedEmergencyCommunicationAdapter, toCommunicationIntent } from './emergency-communication-bridge.js';

test('emergency communication maps into canonical communications.send intent', () => {
  const mapped = toCommunicationIntent({
    intentId: 'intent-1',
    incidentId: 'incident-1',
    actorId: 'user-1',
    recipientId: 'contact-1',
    channel: 'sms',
    templateId: 'critical',
    createdAt: '2026-09-20T17:00:00Z',
  }, 'preauth-1');
  assert.equal(mapped.capability, 'communications.send');
  assert.equal(mapped.recipient.authorization.evidenceRef, 'preauth-1');
  assert.equal(mapped.recipient.trustState, 'trusted');
});

test('governed emergency adapter returns dispatcher receipt', async () => {
  const adapter = new GovernedEmergencyCommunicationAdapter({
    dispatch: async (intent) => ({
      accepted: true,
      providerReference: `provider:${intent.intentId}`,
    }),
  }, 'preauth-1');

  const receipt = await adapter.send({
    intentId: 'intent-2',
    incidentId: 'incident-1',
    actorId: 'user-1',
    recipientId: 'contact-1',
    channel: 'push',
    templateId: 'test',
    createdAt: '2026-09-20T17:00:00Z',
  });

  assert.equal(receipt.accepted, true);
  assert.equal(receipt.providerReference, 'provider:intent-2');
});
