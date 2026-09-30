import { describe, expect, it } from 'vitest';
import { analyzeBuyerSignals, calculatePerformanceSignal, isPerformanceOutlier } from './social-discovery.js';

describe('social discovery', () => {
  it('recognizes high-intent purchase language', () => {
    const result = analyzeBuyerSignals(['Where can I buy this?', 'How much is it?']);
    expect(result.level).toBe('high');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('recognizes medium-intent research language', () => {
    expect(analyzeBuyerSignals(['Which one do you recommend?']).level).toBe('medium');
  });

  it('recognizes weak signals without overstating intent', () => {
    const result = analyzeBuyerSignals(['This is beautiful']);
    expect(result.level).toBe('low');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('detects an outlier relative to creator baseline', () => {
    const signal = calculatePerformanceSignal({
      id: 'obs-1' as never,
      platform: 'instagram',
      sourceUrl: 'https://example.com/post',
      observedAt: new Date().toISOString(),
      mediaType: 'video',
      engagement: { views: 100_000, likes: 10_000, comments: 1_000, shares: 500, saves: 500 },
      audienceSignals: [],
      commercialSignals: [],
      provenance: ['public'],
    }, { creatorBaseline: 0.01, hoursObserved: 24, crossPlatformPresence: 0.5 });

    expect(signal.performanceLift).toBeGreaterThanOrEqual(10);
    expect(isPerformanceOutlier(signal)).toBe(true);
  });
});
