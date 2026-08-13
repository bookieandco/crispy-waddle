import { describe, expect, it } from 'vitest';
import { CampaignExecutionOrchestrator } from './campaign-orchestrator.js';
import { ChannelRegistry, MockChannelAdapter } from './channel-registry.js';
import type { AdAsset } from '../creative/ad-asset.js';

const asset: AdAsset = { id: 'asset-1', briefId: 'brief-1', type: 'video', title: 'Demo', version: 1, status: 'ready', metadata: {} };

function makeOrchestrator() {
  const registry = new ChannelRegistry();
  registry.register(new MockChannelAdapter('meta'));
  return new CampaignExecutionOrchestrator(registry);
}

describe('CampaignExecutionOrchestrator', () => {
  it('blocks execution without complete approval', async () => {
    await expect(makeOrchestrator().execute({
      channel: 'meta', campaignId: 'campaign-1', name: 'Test', objective: 'Acquire', asset,
      approval: { approved: false },
    })).rejects.toThrow('requires approval');
  });

  it('executes through the registered adapter after approval', async () => {
    const result = await makeOrchestrator().execute({
      channel: 'meta', campaignId: 'campaign-1', name: 'Test', objective: 'Acquire', asset,
      approval: { approved: true, approvedAt: '2026-08-12T18:00:00Z', policyDecisionId: 'policy-1' },
    });

    expect(result.externalCampaignId).toBe('meta:campaign-1');
    expect(result.policyDecisionId).toBe('policy-1');
    expect(result.channel).toBe('meta');
  });
});
