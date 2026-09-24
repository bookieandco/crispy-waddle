import { describe, expect, it } from 'vitest';
import { rankTargetCandidates } from './social-target-graph.js';

describe('social target graph', () => {
  it('ranks a commercially active target above attention-only activity', () => {
    const result = rankTargetCandidates({
      nodes: [
        { id: 'person:buyer' as never, platform: 'instagram', externalRef: 'buyer', kind: 'person' },
        { id: 'person:fan' as never, platform: 'instagram', externalRef: 'fan', kind: 'person' },
      ],
      edges: [
        { from: 'post:1' as never, to: 'person:buyer' as never, signal: 'buyer_intent', weight: 0.95, observedAt: '2026-08-31T00:00:00Z', evidence: ['comment:1' as never] },
        { from: 'post:1' as never, to: 'person:buyer' as never, signal: 'audience_fit', weight: 0.9, observedAt: '2026-08-31T00:00:00Z', evidence: [] },
        { from: 'post:2' as never, to: 'person:fan' as never, signal: 'engagement', weight: 1, observedAt: '2026-08-31T00:00:00Z', evidence: ['like:2' as never] },
      ],
    });
    expect(result[0].nodeId).toBe('person:buyer');
    expect(result[0].reasons).toContain('buyer_intent');
  });
});
