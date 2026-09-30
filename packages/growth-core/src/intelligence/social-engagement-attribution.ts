import type { GrowthId } from '../domain/types.js';

export interface CommentEngagementObservation {
  readonly commentId: GrowthId;
  readonly accountId: GrowthId;
  readonly platform: string;
  readonly observedAt: string;
  readonly replies: number;
  readonly likes: number;
  readonly profileVisits: number;
  readonly follows: number;
  readonly linkClicks: number;
  readonly conversions: number;
  readonly revenue: number;
}

export interface CommentEngagementScore {
  readonly commentId: GrowthId;
  readonly attentionScore: number;
  readonly intentScore: number;
  readonly conversionScore: number;
  readonly revenue: number;
}

const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const normalize = (value: number, scale: number) => Math.min(1, nonNegative(value) / scale);

export function scoreCommentEngagement(observation: CommentEngagementObservation): CommentEngagementScore {
  const replies = nonNegative(observation.replies);
  const likes = nonNegative(observation.likes);
  const visits = nonNegative(observation.profileVisits);
  const follows = nonNegative(observation.follows);
  const clicks = nonNegative(observation.linkClicks);
  const conversions = nonNegative(observation.conversions);
  return {
    commentId: observation.commentId,
    attentionScore: Math.min(1, normalize(replies, 10) * 0.45 + normalize(likes, 50) * 0.25 + normalize(visits, 10) * 0.3),
    intentScore: Math.min(1, normalize(visits, 10) * 0.35 + normalize(follows, 5) * 0.2 + normalize(clicks, 5) * 0.45),
    conversionScore: conversions > 0 ? Math.min(1, normalize(conversions, 5) * 0.7 + normalize(observation.revenue, 500) * 0.3) : 0,
    revenue: nonNegative(observation.revenue),
  };
}
