import type { GrowthId } from '../domain/types.js';
import type { CreativePattern } from './creative-pattern-selection.js';

export type AdaptationTone = 'baseline' | 'playful' | 'professional' | 'bold' | 'mascot';

export interface CreativeAdaptationRequest {
  readonly id: GrowthId;
  readonly accountId: GrowthId;
  readonly brandId: GrowthId;
  readonly tone: AdaptationTone;
  readonly pattern: CreativePattern;
  readonly audienceIds: readonly GrowthId[];
  readonly constraints: readonly string[];
}

export interface CreativeAdaptationPlan {
  readonly id: GrowthId;
  readonly accountId: GrowthId;
  readonly brandId: GrowthId;
  readonly tone: AdaptationTone;
  readonly preserve: readonly string[];
  readonly transform: readonly string[];
  readonly prohibit: readonly string[];
  readonly sourcePatternId: GrowthId;
  readonly provenance: readonly string[];
  readonly requiresHumanReview: true;
}

export function buildCreativeAdaptationPlan(request: CreativeAdaptationRequest): CreativeAdaptationPlan {
  return {
    id: `adaptation:${request.id}` as GrowthId,
    accountId: request.accountId,
    brandId: request.brandId,
    tone: request.tone,
    preserve: ['hook_style', 'format', 'emotional_frame', 'audience_fit'],
    transform: ['wording', 'examples', 'visual_expression', 'brand_voice', 'account_specific_tone'],
    prohibit: ['verbatim_copy', 'source_identity_impersonation', 'unsupported_claims', 'unauthorized_brand_elements'],
    sourcePatternId: request.pattern.id,
    provenance: request.pattern.provenance,
    requiresHumanReview: true,
  };
}
