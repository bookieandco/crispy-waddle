import type { GrowthEvent } from './event-contract.js';
import type { GrowthId, ISODateTime } from '../domain/types.js';

export type OrganicPlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'x' | 'reddit';
export type OrganicMetric = 'impressions' | 'reach' | 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'reposts' | 'clicks' | 'profile_visits' | 'followers_gained' | 'leads';

export interface OrganicPostSnapshot {
  platform: OrganicPlatform;
  postId: string;
  accountId: string;
  publishedAt?: ISODateTime;
  url?: string;
  format?: string;
  titleOrHook?: string;
  creativeId?: GrowthId;
  experimentId?: GrowthId;
}

export interface OrganicMetricObservation {
  metric: OrganicMetric;
  value: number;
  capturedAt: ISODateTime;
  windowStart?: ISODateTime;
  windowEnd?: ISODateTime;
}

export interface OrganicSocialPayload {
  post: OrganicPostSnapshot;
  observations: readonly OrganicMetricObservation[];
}

export type OrganicSocialEvent = GrowthEvent<OrganicSocialPayload>;

export function normalizeOrganicSocialEvent(input: {
  eventId: GrowthId;
  platform: OrganicPlatform;
  post: OrganicPostSnapshot;
  observations: readonly OrganicMetricObservation[];
  actor?: string;
  source?: string;
  occurredAt: ISODateTime;
  correlationId: GrowthId;
  idempotencyKey: string;
}): OrganicSocialEvent {
  return {
    eventId: input.eventId,
    eventType: 'learning_created',
    entityType: 'organic_social_post',
    entityId: `${input.platform}:${input.post.postId}`,
    actor: input.actor ?? 'organic-social-adapter',
    source: input.source ?? `organic:${input.platform}`,
    payload: { post: input.post, observations: input.observations },
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  };
}
