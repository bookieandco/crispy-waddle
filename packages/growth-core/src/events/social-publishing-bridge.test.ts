import { describe, expect, it } from 'vitest';
import { socialPostPublishedEvents } from './social-publishing-bridge.js';

describe('socialPostPublishedEvents', () => {
  it('emits one canonical event per platform with stable idempotency', () => {
    const events = socialPostPublishedEvents({
      id: 'post:123',
      brand: 'bookieandco',
      platforms: ['instagram', 'tiktok'],
      text: 'Test post',
      providerPostIds: { instagram: 'ig:456', tiktok: 'tt:789' },
      occurredAt: '2026-08-27T12:00:00.000Z',
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      eventType: 'content_published',
      entityType: 'social_post',
      entityId: 'post:123',
      correlationId: 'post:123',
      idempotencyKey: 'social:post:123:published:instagram:ig:456',
    });
    expect(events[1].payload).toMatchObject({ platform: 'tiktok', providerPostId: 'tt:789' });
  });
});
