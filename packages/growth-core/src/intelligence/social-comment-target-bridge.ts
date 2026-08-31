import type { GrowthId } from '../domain/types.js';
import type { SocialTargetOpportunity } from './social-target-opportunity.js';
import type { CommentOpportunity, CommentDraft, SocialAccountPersona } from './social-comment-personas.js';
import type { VoiceContext } from './voice-context.js';
import { generateGovernedComment, type SocialCommentGenerator } from './social-comment-generation.js';
import { chooseCommentStrategy, type CommentStrategyPlan } from './social-comment-strategy.js';

export interface TargetAwareCommentRequest {
  readonly id: GrowthId;
  readonly target: SocialTargetOpportunity;
  readonly opportunity: CommentOpportunity;
  readonly persona: SocialAccountPersona;
  readonly voice: VoiceContext;
  readonly generator: SocialCommentGenerator;
}

export interface TargetAwareCommentPlan {
  readonly id: GrowthId;
  readonly targetOpportunityId: GrowthId;
  readonly commentOpportunityId: GrowthId;
  readonly strategy: CommentStrategyPlan;
  readonly targetId: GrowthId;
  readonly audienceId: GrowthId;
  readonly accountId: GrowthId;
  readonly objective: SocialTargetOpportunity['objective'];
  readonly requiresHumanReview: true;
}

export function buildTargetAwareCommentPlan(request: TargetAwareCommentRequest): TargetAwareCommentPlan {
  if (request.target.targetId !== request.opportunity.postId) {
    throw new Error('TARGET_COMMENT_CONTEXT_MISMATCH');
  }
  if (request.target.audienceId !== request.target.audienceId) throw new Error('TARGET_AUDIENCE_MISMATCH');
  const strategy = chooseCommentStrategy(request.target, request.opportunity);
  return {
    id: `target-comment:${request.id}` as GrowthId,
    targetOpportunityId: request.target.id,
    commentOpportunityId: request.opportunity.id,
    strategy,
    targetId: request.target.targetId,
    audienceId: request.target.audienceId,
    accountId: request.persona.accountId,
    objective: request.target.objective,
    requiresHumanReview: true,
  };
}

export async function generateTargetAwareComment(request: TargetAwareCommentRequest): Promise<{ plan: TargetAwareCommentPlan; draft: CommentDraft }> {
  const plan = buildTargetAwareCommentPlan(request);
  const governedOpportunity: CommentOpportunity = {
    ...request.opportunity,
    context: `${request.opportunity.context}\nstrategy:${plan.strategy.strategy}\nobjective:${plan.objective}`,
  };
  const draft = await generateGovernedComment({ opportunity: governedOpportunity, persona: request.persona, voice: request.voice, generator: request.generator });
  return { plan, draft };
}
