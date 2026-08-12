import { describe, expect, it } from 'vitest';
import type { Conversion, Touchpoint } from './touchpoint.js';

describe('attribution contracts', () => {
  it('preserves creative-to-touchpoint lineage', () => {
    const touchpoint: Touchpoint = {
      id: 'tp-1',
      type: 'click',
      occurredAt: '2026-08-12T18:00:00.000Z',
      channelId: 'meta',
      campaignId: 'campaign-1',
      creativeId: 'creative-1',
      assetId: 'asset-1',
      sessionId: 'session-1',
      source: 'meta',
    };

    expect(touchpoint.creativeId).toBe('creative-1');
    expect(touchpoint.assetId).toBe('asset-1');
    expect(touchpoint.campaignId).toBe('campaign-1');
  });

  it('links a conversion to the downstream order and customer when available', () => {
    const conversion: Conversion = {
      id: 'conversion-1',
      occurredAt: '2026-08-12T18:05:00.000Z',
      conversionType: 'purchase',
      customerId: 'customer-1',
      orderId: 'order-1',
      sessionId: 'session-1',
      value: 120,
      currency: 'USD',
      source: 'commerce',
    };

    expect(conversion.orderId).toBe('order-1');
    expect(conversion.customerId).toBe('customer-1');
    expect(conversion.value).toBe(120);
  });
});
