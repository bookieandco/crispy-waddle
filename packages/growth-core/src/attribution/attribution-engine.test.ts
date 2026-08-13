import { describe, expect, it } from 'vitest';
import { AttributionEngine } from './attribution-engine.js';
import type { Conversion, Touchpoint } from './touchpoint.js';

const touchpoints: Touchpoint[] = [
  { id: 'tp-1', type: 'view', occurredAt: '2026-08-12T10:00:00.000Z', creativeId: 'creative-a', campaignId: 'campaign-a', channelId: 'meta', source: 'meta' },
  { id: 'tp-2', type: 'click', occurredAt: '2026-08-12T11:00:00.000Z', creativeId: 'creative-b', campaignId: 'campaign-b', channelId: 'x', source: 'x' },
];

const conversion: Conversion = {
  id: 'conversion-1',
  occurredAt: '2026-08-12T12:00:00.000Z',
  conversionType: 'purchase',
  orderId: 'order-1',
  value: 100,
  currency: 'USD',
  source: 'commerce',
};

describe('AttributionEngine', () => {
  it('assigns first-touch credit to the earliest touchpoint', () => {
    const result = new AttributionEngine().attribute(conversion, touchpoints, 'first_touch');
    expect(result.credits).toHaveLength(1);
    expect(result.credits[0].touchpointId).toBe('tp-1');
    expect(result.credits[0].credit).toBe(1);
  });

  it('assigns last-touch credit to the latest touchpoint', () => {
    const result = new AttributionEngine().attribute(conversion, touchpoints, 'last_touch');
    expect(result.credits[0].touchpointId).toBe('tp-2');
  });

  it('splits linear credit across eligible touchpoints', () => {
    const result = new AttributionEngine().attribute(conversion, touchpoints, 'linear');
    expect(result.credits).toHaveLength(2);
    expect(result.credits.reduce((sum, item) => sum + item.credit, 0)).toBe(1);
  });

  it('does not attribute touchpoints after the conversion', () => {
    const future: Touchpoint = { ...touchpoints[1], id: 'tp-future', occurredAt: '2026-08-12T13:00:00.000Z' };
    const result = new AttributionEngine().attribute(conversion, [...touchpoints, future], 'linear');
    expect(result.sourceTouchpointIds).not.toContain('tp-future');
  });
});
