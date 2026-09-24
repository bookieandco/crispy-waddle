import { describe, expect, it } from 'vitest';
import { mediaSignalToGraphDelta } from './media-signal-graph.js';

describe('media signal graph', () => {
  it('projects entities, topics and content with provenance', () => {
    const delta = mediaSignalToGraphDelta({ id: 'signal:1' as never, source: 'source', sourceType: 'podcast', observedAt: '2026-08-31T00:00:00Z', entityRefs: ['entity:1' as never], topicRefs: ['topic:1' as never], audienceSignals: [], contentRefs: ['content:1' as never], engagementSignals: {}, commercialSignals: {}, confidence: 0.8, provenance: ['podcast:episode:1'], permissions: ['public'] });
    expect(delta.nodes).toHaveLength(3);
    expect(delta.edges).toHaveLength(3);
    expect(delta.edges.every((edge) => edge.confidence === 0.8)).toBe(true);
    expect(delta.edges.every((edge) => edge.evidence.includes('podcast:episode:1'))).toBe(true);
  });
});
