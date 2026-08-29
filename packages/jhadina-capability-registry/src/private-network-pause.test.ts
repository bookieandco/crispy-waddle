import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AllowlistedNetworkPolicy, PrivateNetworkGateway, type VpnProfile, type VpnProvider } from './private-network.js';

const profile: VpnProfile = { id: 'home', name: 'Home', provider: 'wireguard', endpoint: 'vpn.example.test:51820', routes: [], allowedNetworks: ['192.168.1.0/24'], autoConnect: false };

describe('VPN pause/resume control', () => {
  it('pauses and resumes the current profile without losing it', async () => {
    let connected = false;
    let connects = 0;
    let disconnects = 0;
    const provider: VpnProvider = {
      kind: 'wireguard',
      connect: async () => { connected = true; connects += 1; },
      disconnect: async () => { connected = false; disconnects += 1; },
      status: async () => ({ state: connected ? 'connected' : 'offline', profileId: profile.id }),
    };
    const gateway = new PrivateNetworkGateway(provider, new AllowlistedNetworkPolicy());

    assert.equal((await gateway.connect(profile)).state, 'connected');
    assert.equal((await gateway.pause()).state, 'paused');
    assert.equal((await gateway.status()).state, 'paused');
    assert.equal(disconnects, 1);
    assert.equal((await gateway.resume()).state, 'connected');
    assert.equal(connects, 2);
  });

  it('toggle alternates between paused and connected', async () => {
    const provider: VpnProvider = { kind: 'wireguard', connect: async () => {}, disconnect: async () => {}, status: async () => ({ state: 'connected', profileId: profile.id }) };
    const gateway = new PrivateNetworkGateway(provider, new AllowlistedNetworkPolicy());
    await gateway.connect(profile);
    assert.equal((await gateway.toggle()).state, 'paused');
    assert.equal((await gateway.toggle()).state, 'connected');
  });

  it('resume fails safely when there is no saved profile', async () => {
    const provider: VpnProvider = { kind: 'wireguard', connect: async () => {}, disconnect: async () => {}, status: async () => ({ state: 'offline' }) };
    const gateway = new PrivateNetworkGateway(provider, new AllowlistedNetworkPolicy());
    assert.equal((await gateway.resume()).state, 'offline');
  });
});
