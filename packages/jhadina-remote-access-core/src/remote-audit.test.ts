import { describe, expect, it } from 'vitest';
import { createRemoteAuditEvent } from './remote-audit.js';

describe('remote audit events', () => {
  it('creates an immutable event with identity and timestamp', () => {
    const event = createRemoteAuditEvent({
      type: 'session.connected', sessionId: 'sess-1', protocol: 'ssh',
      host: 'server.example', port: 22,
    });
    expect(event.id).toEqual(expect.any(String));
    expect(event.timestamp).toEqual(expect.any(String));
    expect(event).not.toHaveProperty('password');
    expect(event).not.toHaveProperty('privateKey');
  });

  it('supports command hashes without storing command text', () => {
    const event = createRemoteAuditEvent({
      type: 'command.completed', sessionId: 'sess-1', protocol: 'ssh',
      host: 'server.example', port: 22, commandHash: 'sha256:abc',
    });
    expect(event.commandHash).toBe('sha256:abc');
    expect(event).not.toHaveProperty('command');
  });
});
