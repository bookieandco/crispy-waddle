import { describe, expect, it } from 'vitest';
import { FakeSshTransport } from './fake-ssh-transport.js';
import { connectAuthorizedSsh, executeAuthorizedSsh, SshAuthorizationError } from './ssh-authorized-session.js';
import type { SshSecurityPolicy } from './ssh-security-policy.js';

const policy: SshSecurityPolicy = {
  allowedHosts: ['server.example'], allowedPorts: [22], requireHostKeyVerification: true,
  credentialRef: { id: 'cred-1' }, allowedCommands: ['uname -a'],
};

const request = { host: 'server.example', port: 22, credentialRef: { id: 'cred-1' }, hostKeyVerified: true };

describe('authorized SSH session', () => {
  it('connects only after policy approval', async () => {
    const transport = new FakeSshTransport();
    const session = await connectAuthorizedSsh(transport, policy, request, {});
    await expect(session.execute('uname -a')).resolves.toBe('fake-ssh:uname -a');
  });

  it('blocks unauthorized connection before transport access', async () => {
    const transport = new FakeSshTransport();
    await expect(connectAuthorizedSsh(transport, policy, { ...request, host: 'evil.example' }, {}))
      .rejects.toBeInstanceOf(SshAuthorizationError);
    expect(transport.commands).toEqual([]);
  });

  it('blocks unauthorized command at the session boundary', async () => {
    const transport = new FakeSshTransport();
    const session = await connectAuthorizedSsh(transport, policy, request, {});
    await expect(executeAuthorizedSsh(session, policy, { ...request, command: 'id' }))
      .rejects.toThrow('SSH request denied: command-not-allowed');
    expect(transport.commands).toEqual([]);
  });
});
