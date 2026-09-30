import type { GrowthId } from '../domain/types.js';
import type { CommentStrategy } from './social-comment-strategy.js';

export interface CommentEngagementOutcome {
  readonly commentId: GrowthId;
  readonly accountId: GrowthId;
  readonly targetId: GrowthId;
  readonly strategy: CommentStrategy;
  readonly tone: string;
  readonly impressions?: number;
  readonly likes: number;
  readonly replies: number;
  readonly profileVisits?: number;
  readonly clicks?: number;
  readonly qualifiedLeads?: number;
  readonly conversions?: number;
  readonly recordedAt: string;
}

export interface CommentLearningSignal {
  readonly id: GrowthId;
  readonly commentId: GrowthId;
  readonly accountId: GrowthId;
  readonly targetId: GrowthId;
  readonly strategy: CommentStrategy;
  readonly engagementRate: number;
  readonly conversationRate: number;
  readonly leadRate: number;
  readonly conversionRate: number;
  readonly signalScore: number;
  readonly recommendations: readonly string[];
  readonly provenance: readonly string[];
}

const ratio = (n: number | undefined, d: number | undefined) => d && d > 0 ? Math.max(0, n ?? 0) / d : 0;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function learnFromCommentOutcome(outcome: CommentEngagementOutcome): CommentLearningSignal {
  const base = Math.max(1, outcome.impressions ?? outcome.likes + outcome.replies + (outcome.profileVisits ?? 0));
  const engagementRate = clamp((outcome.likes + outcome.replies) / base);
  const conversationRate = clamp(outcome.replies / base);
  const leadRate = clamp(ratio(outcome.qualifiedLeads, outcome.profileVisits ?? outcome.clicks ?? base));
  const conversionRate = clamp(ratio(outcome.conversions, outcome.qualifiedLeads ?? outcome.clicks ?? base));
  const signalScore = clamp(engagementRate * 0.35 + conversationRate * 0.2 + leadRate * 0.25 + conversionRate * 0.2);
  const recommendations: string[] = [];
  if (conversationRate > 0.03) recommendations.push('increase_weight_for_strategy');
  if (leadRate > 0.05) recommendations.push('increase_weight_for_buyer_intent_targets');
  if (conversionRate > 0.02) recommendations.push('promote_pattern_to_creative_learning');
  if (signalScore < 0.15) recommendations.push('deprioritize_strategy_for_similar_targets');
  return { id: `comment-learning:${outcome.commentId}` as GrowthId, commentId: outcome.commentId, accountId: outcome.accountId, targetId: outcome.targetId, strategy: outcome.strategy, engagementRate, conversationRate, leadRate, conversionRate, signalScore, recommendations, provenance: [`comment:${outcome.commentId}`, `target:${outcome.targetId}`, `recorded:${outcome.recordedAt}`] };
}
