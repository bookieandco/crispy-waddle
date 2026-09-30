import type { GrowthId } from '../domain/types.js';
import type { SocialTargetOpportunity } from './social-target-opportunity.js';
import type { CommentOpportunity } from './social-comment-personas.js';

export type CommentStrategy = 'conversation_hook' | 'value_add' | 'playful_challenge' | 'soft_qualification';

export interface CommentStrategyPlan {
  readonly id: GrowthId;
  readonly targetOpportunityId: GrowthId;
  readonly strategy: CommentStrategy;
  readonly objective: SocialTargetOpportunity['objective'];
  readonly intentSignalsToUse: readonly string[];
  readonly avoid: readonly string[];
  readonly requiresHumanReview: true;
}

export function chooseCommentStrategy(target: SocialTargetOpportunity, opportunity: CommentOpportunity): CommentStrategyPlan {
  if (opportunity.risk > 0.4) {
    return { id: `comment-strategy:${target.id}` as GrowthId, targetOpportunityId: target.id, strategy: 'value_add', objective: target.objective, intentSignalsToUse: ['relevance', 'context'], avoid: ['provocation', 'personalized_pressure'], requiresHumanReview: true };
  }
  if (target.objective === 'qualified_lead') {
    return { id: `comment-strategy:${target.id}` as GrowthId, targetOpportunityId: target.id, strategy: 'soft_qualification', objective: target.objective, intentSignalsToUse: ['buyer_intent', 'relevance'], avoid: ['hard_sell', 'false_urgency'], requiresHumanReview: true };
  }
  if (target.objective === 'attention') {
    return { id: `comment-strategy:${target.id}` as GrowthId, targetOpportunityId: target.id, strategy: 'playful_challenge', objective: target.objective, intentSignalsToUse: ['engagement_potential', 'recent_activity'], avoid: ['harassment', 'baiting'], requiresHumanReview: true };
  }
  return { id: `comment-strategy:${target.id}` as GrowthId, targetOpportunityId: target.id, strategy: 'conversation_hook', objective: target.objective, intentSignalsToUse: ['relevance', 'audience_fit'], avoid: ['spam', 'generic_engagement'], requiresHumanReview: true };
}
