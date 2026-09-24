import { describe, expect, it } from 'vitest';
import { FakeSshTransport } from './fake-ssh-transport.js';

describe('FakeSshTransport', () => {
  it('connects, executes, records, and closes deterministically', async () => {
    const transport = new FakeSshTransport();
    const session = await transport.connect({ host: 'example.test', port: 22 });
    expect(session.state).toBe('connected');
    await expect(session.execute('uname -a')).resolves.toBe('fake-ssh:uname -a');
    expect(transport.commands).toEqual(['uname -a']);
    await session.close();
    expect(session.state).toBe('closed');
    await expect(session.execute('id')).rejects.toThrow('Remote session is not connected');
  });

  it('fails before opening a session when cancelled', async () => {
    const transport = new FakeSshTransport();
    const controller = new AbortController();
    controller.abort();
    await expect(transport.connect({}, { signal: controller.signal })).rejects.toThrow('Remote connection aborted');
  });
});
