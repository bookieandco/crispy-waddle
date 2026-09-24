import type { GrowthId } from '../domain/types.js';
import type { VoiceBoundAdaptation } from './voice-adaptation.js';

export type SocialGenerationMode = 'content' | 'comment';

export interface SocialGenerationRequest {
  readonly id: GrowthId;
  readonly mode: SocialGenerationMode;
  readonly accountId: GrowthId;
  readonly targetId?: GrowthId;
  readonly adaptation: VoiceBoundAdaptation;
  readonly objective: 'publish' | 'attention' | 'conversation' | 'test';
  readonly callToAction?: string;
}

export interface SocialGenerationContext {
  readonly requestId: GrowthId;
  readonly mode: SocialGenerationMode;
  readonly accountId: GrowthId;
  readonly targetId?: GrowthId;
  readonly objective: SocialGenerationRequest['objective'];
  readonly voiceProfileId: GrowthId;
  readonly tone: VoiceBoundAdaptation['tone'];
  readonly traits: readonly string[];
  readonly preferredPhrases: readonly string[];
  readonly forbiddenPatterns: readonly string[];
  readonly styleWeights: VoiceBoundAdaptation['styleWeights'];
  readonly sourcePatternId: GrowthId;
  readonly provenance: readonly string[];
  readonly safetyRequirements: readonly string[];
  readonly requiresHumanReview: true;
}

export function buildSocialGenerationContext(request: SocialGenerationRequest): SocialGenerationContext {
  if (request.accountId !== request.adaptation.accountId) throw new Error('GENERATION_ACCOUNT_MISMATCH');
  return {
    requestId: request.id,
    mode: request.mode,
    accountId: request.accountId,
    targetId: request.targetId,
    objective: request.objective,
    voiceProfileId: request.adaptation.voiceProfileId,
    tone: request.adaptation.tone,
    traits: request.adaptation.traits,
    preferredPhrases: request.adaptation.preferredPhrases,
    forbiddenPatterns: request.adaptation.forbiddenPatterns,
    styleWeights: request.adaptation.styleWeights,
    sourcePatternId: request.adaptation.sourcePatternId,
    provenance: request.adaptation.provenance,
    safetyRequirements: [
      'no_verbatim_source_copy',
      'no_source_identity_impersonation',
      'no_unsupported_claims',
      'respect_platform_rules',
      request.mode === 'comment' ? 'comment_must_add_value_or_invite_conversation' : 'content_must_match_account_brand',
    ],
    requiresHumanReview: true,
  };
}
