import { describe, expect, it } from 'vitest';
import { normalizeMediaSignal } from './media-signal.js';

describe('media signal', () => {
  it('normalizes confidence into the governed range', () => {
    const signal = normalizeMediaSignal({ id: 'signal:1' as never, source: 'example', sourceType: 'news', observedAt: '2026-08-31T00:00:00Z', entityRefs: [], topicRefs: [], audienceSignals: [], contentRefs: [], engagementSignals: {}, commercialSignals: {}, confidence: 2, provenance: ['source:example'], permissions: ['public'] });
    expect(signal.confidence).toBe(1);
  });
});
