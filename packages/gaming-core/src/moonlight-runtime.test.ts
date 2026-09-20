import { describe, expect, it } from 'vitest';
import { MoonlightRemoteRuntime } from './moonlight-runtime.js';

describe('MoonlightRemoteRuntime', () => {
  it('accepts moonlight PC games', async () => {
    const client = { discoverHosts: async () => [], launch: async () => ({ id: 's1', hostId: 'h1', appId: 'steam' }), sendInput: async () => {}, stop: async () => {} };
    const runtime = new MoonlightRemoteRuntime(client);
    expect(await runtime.canLaunch({ id: 'g1', title: 'Test', platform: 'pc', contentUri: 'moonlight://h1/steam' })).toBe(true);
  });

  it('launches through the Moonlight client boundary', async () => {
    let launched = '';
    const client = { discoverHosts: async () => [], launch: async (host: string, app: string) => { launched = `${host}/${app}`; return { id: 's1', hostId: host, appId: app }; }, sendInput: async () => {}, stop: async () => {} };
    const runtime = new MoonlightRemoteRuntime(client);
    const session = await runtime.launch({ id: 'g1', title: 'Test', platform: 'pc', contentUri: 'moonlight://home/steam' }, {});
    expect(launched).toBe('home/steam');
    expect(session.runtimeId).toBe('moonlight-remote');
  });
});
