import { describe, expect, it } from 'vitest';
import { aggregateSignalCluster, areLikelyDuplicates } from './media-signal-deduplication.js';

const signal = (id: string, source: string, observedAt: string) => ({
  id: id as never, source, sourceType: source.includes('podcast') ? 'podcast' as const : 'news' as const,
  observedAt, entityRefs: ['entity:1' as never], topicRefs: ['topic:1' as never], audienceSignals: [], contentRefs: [],
  engagementSignals: {}, commercialSignals: {}, confidence: 0.8, provenance: [source], permissions: ['public'],
});

describe('media signal deduplication', () => {
  it('recognizes same-topic/entity coverage within the temporal window', () => {
    expect(areLikelyDuplicates(signal('signal:1', 'news:a', '2026-08-30T10:00:00Z'), signal('signal:2', 'news:b', '2026-08-30T18:00:00Z'))).toBe(true);
  });

  it('aggregates independent sources into one underlying event cluster', () => {
    const cluster = aggregateSignalCluster([
      signal('signal:1', 'news:a', '2026-08-30T10:00:00Z'),
      signal('signal:2', 'news:b', '2026-08-30T18:00:00Z'),
      signal('signal:3', 'podcast:c', '2026-08-31T08:00:00Z'),
    ]);
    expect(cluster?.sourceCount).toBe(3);
    expect(cluster?.signalIds).toHaveLength(3);
    expect(cluster?.sourceTypes).toEqual(['news', 'podcast']);
  });
});
