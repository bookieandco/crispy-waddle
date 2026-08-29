import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteCommandExecutor, RemoteExecutionError } from './remote-executor.js';
import type { RemoteCommand, RemoteTransport } from './remote.js';

const command: RemoteCommand = { capability: 'remote.power', deviceId: 'tv-1' };
const transport = (kind: 'wifi' | 'ir', priority: number, result: boolean): RemoteTransport => ({
  kind, priority,
  supports: () => true,
  execute: async c => result
    ? { success: true, capability: c.capability, deviceId: c.deviceId, transport: kind, attempts: 1 }
    : { success: false, capability: c.capability, deviceId: c.deviceId, transport: kind, attempts: 1, error: { code: 'FAILED', message: `${kind} failed` } },
});

describe('remote command executor', () => {
  it('uses the first successful transport in resolver order', async () => {
    const attempts: string[] = [];
    const first = transport('wifi', 20, false);
    const second = transport('ir', 10, true);
    const executor = new RemoteCommandExecutor(() => [
      { ...first, execute: async c => { attempts.push('wifi'); return first.execute(c); } },
      { ...second, execute: async c => { attempts.push('ir'); return second.execute(c); } },
    ]);
    const result = await executor.execute(command);
    assert.equal(result.success, true);
    assert.equal(result.transport, 'ir');
    assert.equal(result.attempts, 2);
    assert.deepEqual(attempts, ['wifi', 'ir']);
  });

  it('throws a typed error after all transports fail', async () => {
    const executor = new RemoteCommandExecutor(() => [transport('wifi', 20, false), transport('ir', 10, false)]);
    await assert.rejects(executor.execute(command), (error: unknown) => {
      assert.ok(error instanceof RemoteExecutionError);
      assert.equal(error.failures.length, 2);
      assert.deepEqual(error.failures.map(f => f.transport), ['wifi', 'ir']);
      return true;
    });
  });

  it('fails closed when no transport is available', async () => {
    const executor = new RemoteCommandExecutor(() => []);
    await assert.rejects(executor.execute(command), (error: unknown) => {
      assert.ok(error instanceof RemoteExecutionError);
      assert.equal(error.failures[0]?.code, 'NO_TRANSPORT');
      return true;
    });
  });
});
