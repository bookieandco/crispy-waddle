import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AllowlistedNetworkPolicy, PrivateNetworkGateway, type VpnProfile, type VpnProvider } from './private-network.js';

const profile: VpnProfile = { id: 'home', name: 'Home', provider: 'wireguard', endpoint: 'vpn.example.test:51820', routes: [{ cidr: '192.168.1.0/24' }], allowedNetworks: ['192.168.1.0/24'], autoConnect: false };

describe('private network gateway', () => {
  it('fails closed before VPN connection', async () => {
    const provider: VpnProvider = { kind: 'wireguard', connect: async () => {}, disconnect: async () => {}, status: async () => ({ state: 'offline', profileId: profile.id }) };
    const gateway = new PrivateNetworkGateway(provider, new AllowlistedNetworkPolicy());
    const decision = await gateway.authorize({ deviceId: 'tv-1', host: '192.168.1.50', port: 8009, purpose: 'remote control' }, profile);
    assert.equal(decision.allowed, false);
  });

  it('authorizes an allowlisted destination only after connection', async () => {
    let connected = false;
    const provider: VpnProvider = { kind: 'wireguard', connect: async () => { connected = true; }, disconnect: async () => { connected = false; }, status: async () => ({ state: connected ? 'connected' : 'offline', profileId: profile.id, sessionId: connected ? 'session-1' : undefined }) };
    const gateway = new PrivateNetworkGateway(provider, new AllowlistedNetworkPolicy());
    await gateway.connect(profile);
    assert.equal((await gateway.authorize({ deviceId: 'tv-1', host: '192.168.1.50', port: 8009, purpose: 'remote control' }, profile)).allowed, true);
    assert.equal((await gateway.authorize({ deviceId: 'tv-1', host: '10.0.0.50', port: 8009, purpose: 'remote control' }, profile)).allowed, false);
  });
});
