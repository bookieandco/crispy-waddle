import { describe, expect, it } from 'vitest';
import { auditedCloseSsh, auditedConnectSsh, auditedExecuteSsh } from './audited-ssh-session.js';
import { FakeSshTransport } from './fake-ssh-transport.js';
import type { RemoteAuditEvent, RemoteAuditSink } from './remote-audit.js';
import type { SshSecurityPolicy } from './ssh-security-policy.js';

const policy: SshSecurityPolicy = {
  allowedHosts: ['server.example'], allowedPorts: [22], requireHostKeyVerification: true,
  credentialRef: { id: 'cred-1' }, allowedCommands: ['uname -a'],
};

class RecordingAudit implements RemoteAuditSink {
  readonly events: RemoteAuditEvent[] = [];
  record(event: RemoteAuditEvent): void { this.events.push(event); }
}

describe('SSH audited lifecycle identity', () => {
  it('uses one stable session ID across connect, commands, denial, and close', async () => {
    const audit = new RecordingAudit();
    const transport = new FakeSshTransport();
    const session = await auditedConnectSsh(transport, policy, {
      host: 'server.example', port: 22, credentialRef: { id: 'cred-1' }, hostKeyVerified: true,
    }, {}, audit);

    await auditedExecuteSsh(session, policy, {
      host: 'server.example', port: 22, credentialRef: { id: 'cred-1' }, hostKeyVerified: true, command: 'uname -a',
    }, audit);

    await expect(auditedExecuteSsh(session, policy, {
      host: 'server.example', port: 22, credentialRef: { id: 'cred-1' }, hostKeyVerified: true, command: 'id',
    }, audit)).rejects.toThrow('command-not-allowed');

    await auditedCloseSsh(session, 'server.example', 22, audit);

    expect(session.sessionId).toEqual(expect.any(String));
    expect(audit.events.map(event => event.type)).toEqual([
      'session.connect.requested', 'session.connected', 'command.requested',
      'command.completed', 'command.requested', 'command.denied', 'session.closed',
    ]);
    expect(new Set(audit.events.map(event => event.sessionId)).size).toBe(1);
    expect(audit.events.every(event => event.sessionId === session.sessionId)).toBe(true);
  });
});
