import { describe, expect, it } from 'vitest';
import { assessTrend } from './trend-emergence.js';

describe('trend emergence', () => {
  const cluster = { id: 'cluster:1' as never, representativeId: 'signal:1' as never, signalIds: ['signal:1' as never, 'signal:2' as never], sourceCount: 4, firstObservedAt: '2026-08-31T08:00:00Z', lastObservedAt: '2026-08-31T09:00:00Z', sourceTypes: ['news', 'social'], confidence: 0.9 };

  it('detects a breakout when growth and source diversity accelerate', () => {
    const result = assessTrend(cluster, { clusterId: cluster.id, observedAt: '2026-08-31T08:00:00Z', signalCount: 2, sourceCount: 1 }, { clusterId: cluster.id, observedAt: '2026-08-31T09:00:00Z', signalCount: 5, sourceCount: 4 });
    expect(result.stage).toBe('breakout');
    expect(result.sourceDiversity).toBe(0.8);
  });

  it('detects decline when signal count falls', () => {
    const result = assessTrend(cluster, { clusterId: cluster.id, observedAt: '2026-08-31T08:00:00Z', signalCount: 5, sourceCount: 4 }, { clusterId: cluster.id, observedAt: '2026-08-31T09:00:00Z', signalCount: 3, sourceCount: 3 });
    expect(result.stage).toBe('declining');
  });
});
