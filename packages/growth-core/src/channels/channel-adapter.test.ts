import { describe, expect, it } from 'vitest';
import { assertExecutionApproved } from './channel-adapter.js';

describe('advertising channel execution boundary', () => {
  it('requires explicit policy approval before execution', () => {
    expect(() => assertExecutionApproved({
      requestId: 'request-1',
      channel: 'meta',
      campaignId: 'campaign-1',
      assetId: 'asset-1',
      approved: true,
      approvedAt: '2026-08-12T18:00:00.000Z',
      policyDecisionId: 'policy-1',
    })).not.toThrow();
  });

  it('rejects execution without policy approval', () => {
    expect(() => assertExecutionApproved({
      requestId: 'request-2',
      channel: 'meta',
      campaignId: 'campaign-1',
      assetId: 'asset-1',
      approved: false,
    })).toThrow('explicit policy approval');
  });
});
