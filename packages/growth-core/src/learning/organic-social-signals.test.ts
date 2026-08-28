import { describe, expect, it } from 'vitest';
import { deriveOrganicCreativeSignals } from './organic-social-signals.js';
import { normalizeOrganicSocialEvent } from '../events/organic-social.js';

describe('deriveOrganicCreativeSignals', () => {
  it('preserves creative lineage and normalizes observed metrics', () => {
    const event = normalizeOrganicSocialEvent({
      eventId: 'evt-1',
      platform: 'tiktok',
      post: {
        platform: 'tiktok',
        postId: 'post-1',
        accountId: 'acct-1',
        format: 'ugc',
        titleOrHook: 'Stop scrolling: this changed my morning routine',
        creativeId: 'creative-1',
        experimentId: 'experiment-1',
      },
      observations: [
        { metric: 'views', value: 1200, capturedAt: '2026-08-27T12:00:00Z' },
        { metric: 'shares', value: 42, capturedAt: '2026-08-27T12:00:00Z' },
        { metric: 'leads', value: 8, capturedAt: '2026-08-27T12:00:00Z' },
      ],
      occurredAt: '2026-08-27T12:00:00Z',
      correlationId: 'corr-1',
      idempotencyKey: 'tiktok:post-1:2026-08-27T12:00:00Z',
    });

    expect(deriveOrganicCreativeSignals(event)).toEqual({
      creativeId: 'creative-1',
      experimentId: 'experiment-1',
      platform: 'tiktok',
      format: 'ugc',
      hook: 'Stop scrolling: this changed my morning routine',
      metrics: { views: 1200, shares: 42, leads: 8 },
      evidenceEventIds: ['evt-1'],
    });
  });
});
