import type { AuditSecurityEvent } from './index.js';

const encoder = new TextEncoder();

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function eventPayload(event: AuditSecurityEvent, previousHash: string): string {
  return JSON.stringify({
    id: event.id,
    requestId: event.requestId,
    actorId: event.actorId,
    domain: event.domain,
    capability: event.capability,
    decision: event.decision,
    occurredAt: event.occurredAt,
    previousHash,
  });
}

export type AuditIntegrityResult = {
  valid: boolean;
  index: number;
  reason?: 'broken_previous_hash' | 'tampered_event_hash';
};

export async function verifyAuditChain(events: readonly AuditSecurityEvent[]): Promise<AuditIntegrityResult> {
  let previousHash = 'GENESIS';

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];

    if (event.previousHash !== previousHash) {
      return { valid: false, index, reason: 'broken_previous_hash' };
    }

    const expectedHash = await sha256(eventPayload(event, previousHash));
    if (event.eventHash !== expectedHash) {
      return { valid: false, index, reason: 'tampered_event_hash' };
    }

    previousHash = event.eventHash;
  }

  return { valid: true, index: events.length - 1 };
}
