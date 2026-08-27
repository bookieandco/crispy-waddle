import type { GrowthEvent } from './event-contract.js';
import type { GrowthId, ISODateTime } from '../domain/types.js';

export interface PublishedSocialPost {
  id: GrowthId;
  brand: string;
  platforms: readonly string[];
  text: string;
  mediaUrls?: readonly string[];
  providerPostIds?: Readonly<Record<string, string>>;
  occurredAt?: ISODateTime;
}

/**
 * Converts a successful social publish into canonical Growth Core events.
 * The bridge is intentionally provider-neutral: Social Core owns publishing;
 * Growth Core owns measurement, attribution and learning.
 */
export function socialPostPublishedEvents(
  post: PublishedSocialPost,
  source = 'social-core',
): GrowthEvent[] {
  const occurredAt = post.occurredAt ?? new Date().toISOString();
  const targets = post.platforms.length ? post.platforms : ['unknown'];

  return targets.map((platform) => {
    const providerPostId = post.providerPostIds?.[platform];
    const idempotencyKey = `social:${post.id}:published:${platform}:${providerPostId ?? 'local'}`;

    return {
      eventId: `growth-event:${idempotencyKey}` as GrowthId,
      eventType: 'content_published',
      entityType: 'social_post',
      entityId: post.id,
      actor: 'social-publisher',
      source,
      payload: {
        brand: post.brand,
        platform,
        text: post.text,
        mediaUrls: post.mediaUrls ?? [],
        providerPostId,
      },
      occurredAt,
      correlationId: post.id,
      idempotencyKey,
    };
  });
}
