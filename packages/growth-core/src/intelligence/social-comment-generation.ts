import type { GrowthId } from '../domain/types.js';
import type { VoiceContext } from './voice-context.js';
import type { CommentDraft, CommentOpportunity, SocialAccountPersona } from './social-comment-personas.js';
import { createCommentDraft } from './social-comment-personas.js';

export interface SocialCommentGenerator {
  generate(input: { opportunity: CommentOpportunity; persona: SocialAccountPersona; voice: VoiceContext }): Promise<string>;
}

export interface CommentGenerationRequest {
  readonly opportunity: CommentOpportunity;
  readonly persona: SocialAccountPersona;
  readonly voice: VoiceContext;
  readonly generator: SocialCommentGenerator;
}

export async function generateGovernedComment(request: CommentGenerationRequest): Promise<CommentDraft> {
  if (request.opportunity.accountId !== request.persona.accountId || request.voice.accountId !== request.persona.accountId) {
    throw new Error('comment_generation_identity_mismatch');
  }
  if (request.voice.platform !== request.persona.platform) {
    throw new Error('comment_generation_platform_mismatch');
  }

  const text = await request.generator.generate({
    opportunity: request.opportunity,
    persona: request.persona,
    voice: request.voice,
  });

  return createCommentDraft(request.persona, request.opportunity, text);
}

export interface CommentGenerationEvent {
  readonly id: GrowthId;
  readonly draft: CommentDraft;
  readonly generatedAt: string;
  readonly voiceId: GrowthId;
}
