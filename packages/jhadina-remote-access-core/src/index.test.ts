import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DefaultRemoteAccessPolicy,
  InMemoryRemoteAccessRuntime,
  type RemoteAccessProvider,
  type RemoteEndpoint,
  type RemoteSessionRequest,
} from './index.js';

const endpoint: RemoteEndpoint = {
  id: 'server-1',
  protocol: 'ssh',
  host: 'server.example.internal',
  port: 22,
};

function request(operation: RemoteSessionRequest['operation']): RemoteSessionRequest {
  return {
    capability: 'remote.session',
    operation,
    endpoint,
    requestedBy: 'test-user',
  };
}

const grant = {
  capability: 'remote.session',
  protocols: ['ssh'] as const,
  operations: ['connect', 'disconnect', 'execute'] as const,
  endpointIds: ['server-1'] as const,
};

class FakeSshProvider implements RemoteAccessProvider {
  readonly protocol = 'ssh' as const;
  connected = false;

  async connect(): Promise<import('./index.js').RemoteSession> {
    this.connected = true;
    return {
      id: 'session-1',
      endpoint,
      protocol: 'ssh',
      connectedAt: new Date().toISOString(),
    };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async execute(_session: import('./index.js').RemoteSession, command: string): Promise<string> {
    return `executed:${command}`;
  }
}

test('policy rejects an unauthorized protocol', () => {
  const policy = new DefaultRemoteAccessPolicy();
  assert.throws(() =>
    policy.authorize(
      { ...request('connect'), endpoint: { ...endpoint, protocol: 'vnc' } },
      grant,
    ),
  );
});

test('policy rejects an expired grant', () => {
  const policy = new DefaultRemoteAccessPolicy();
  assert.throws(() =>
    policy.authorize(request('connect'), { ...grant, expiresAt: '2000-01-01T00:00:00.000Z' }),
  );
});

test('runtime routes an authorized SSH session to its provider', async () => {
  const provider = new FakeSshProvider();
  const runtime = new InMemoryRemoteAccessRuntime();
  runtime.registerProvider(provider);

  const session = await runtime.open(request('connect'), grant);
  assert.equal(session.protocol, 'ssh');
  assert.equal(provider.connected, true);

  const output = await runtime.execute(request('execute'), grant, session, 'hostname');
  assert.equal(output, 'executed:hostname');

  await runtime.close(request('disconnect'), grant, session);
  assert.equal(provider.connected, false);
});

test('runtime requires explicit execute permission', async () => {
  const provider = new FakeSshProvider();
  const runtime = new InMemoryRemoteAccessRuntime();
  runtime.registerProvider(provider);
  const session = await runtime.open(request('connect'), grant);

  await assert.rejects(() =>
    runtime.execute(
      request('execute'),
      { ...grant, operations: ['connect', 'disconnect'] as const },
      session,
      'hostname',
    ),
  );
});
