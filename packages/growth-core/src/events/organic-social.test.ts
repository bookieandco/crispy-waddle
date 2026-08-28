import { describe, expect, it } from 'vitest';
import { normalizeOrganicSocialEvent } from './organic-social.js';
import { assertGrowthEvent } from './event-contract.js';

describe('organic social event contract', () => {
  it('normalizes platform metrics with provenance and idempotency', () => {
    const event = normalizeOrganicSocialEvent({
      eventId: 'event:organic:1',
      platform: 'instagram',
      post: { platform: 'instagram', postId: 'post-1', accountId: 'acct-1', format: 'short_video', creativeId: 'creative:1' },
      observations: [{ metric: 'views', value: 1200, capturedAt: '2026-08-27T20:00:00Z' }],
      occurredAt: '2026-08-27T20:00:00Z',
      correlationId: 'correlation:1',
      idempotencyKey: 'instagram:acct-1:post-1:2026-08-27T20:00:00Z',
    });

    assertGrowthEvent(event);
    expect(event.entityId).toBe('instagram:post-1');
    expect(event.source).toBe('organic:instagram');
    expect(event.payload.observations[0].metric).toBe('views');
  });

  it('keeps creative and experiment lineage when supplied', () => {
    const event = normalizeOrganicSocialEvent({
      eventId: 'event:organic:2',
      platform: 'tiktok',
      post: { platform: 'tiktok', postId: 'post-2', accountId: 'acct-2', creativeId: 'creative:2', experimentId: 'experiment:2' },
      observations: [],
      occurredAt: '2026-08-27T20:00:00Z',
      correlationId: 'correlation:2',
      idempotencyKey: 'tiktok:acct-2:post-2:2026-08-27T20:00:00Z',
    });

    expect(event.payload.post.creativeId).toBe('creative:2');
    expect(event.payload.post.experimentId).toBe('experiment:2');
  });
});
