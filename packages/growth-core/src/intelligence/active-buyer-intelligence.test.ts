import { describe, expect, it } from 'vitest';
import { aggregateActiveBuyers, extractActiveBuyerSignal } from './active-buyer-intelligence.js';

const observation = (id: string, platform: 'instagram' | 'tiktok', topic: string, signals: string[]) => ({
  id: id as never,
  platform,
  sourceUrl: `https://example.com/${id}`,
  observedAt: new Date().toISOString(),
  mediaType: 'text' as const,
  topic,
  text: signals.join(' '),
  engagement: {},
  audienceSignals: signals,
  commercialSignals: [],
  provenance: ['public'],
});

describe('active buyer intelligence', () => {
  it('promotes explicit purchase language to high intent', () => {
    expect(extractActiveBuyerSignal(observation('1', 'instagram', 'pet portraits', ['Where can I buy this?'])).intentLevel).toBe('high');
  });

  it('aggregates buyer signals by topic and platform', () => {
    const clusters = aggregateActiveBuyers([
      observation('1', 'instagram', 'pet portraits', ['Where can I buy this?']),
      observation('2', 'tiktok', 'pet portraits', ['How much is it?']),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].signalCount).toBe(2);
    expect(clusters[0].highIntentCount).toBe(2);
    expect(clusters[0].platforms).toEqual(expect.arrayContaining(['instagram', 'tiktok']));
  });
});
