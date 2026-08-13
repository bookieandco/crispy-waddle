import { describe, expect, it } from 'vitest';
import { ChannelRegistry, MockChannelAdapter } from './channel-registry.js';
import type { AdAsset } from '../creative/ad-asset.js';

const asset: AdAsset = {
  id: 'asset-1', briefId: 'brief-1', type: 'video', title: 'Demo', version: 1,
  status: 'ready', metadata: {},
};

describe('ChannelRegistry', () => {
  it('registers and resolves provider adapters', () => {
    const registry = new ChannelRegistry();
    const meta = new MockChannelAdapter('meta');
    registry.register(meta);
    expect(registry.get('meta')).toBe(meta);
  });

  it('creates and reads a normalized mock campaign', async () => {
    const adapter = new MockChannelAdapter('google');
    const created = await adapter.createCampaign({
      campaignId: 'campaign-1', name: 'Test', objective: 'Acquire customers', asset,
    });
    const metrics = await adapter.fetchMetrics(created.externalCampaignId);
    expect(created.externalCampaignId).toBe('google:campaign-1');
    expect(metrics.spend).toBe(0);
    expect(metrics.impressions).toBe(0);
  });

  it('rejects assets that are not ready or approved', async () => {
    const adapter = new MockChannelAdapter('meta');
    await expect(adapter.validateAsset({ ...asset, status: 'draft' })).rejects.toThrow('not ready');
  });

  it('fails clearly when an adapter is not registered', () => {
    expect(() => new ChannelRegistry().get('amazon')).toThrow('No advertising adapter registered');
  });
});
