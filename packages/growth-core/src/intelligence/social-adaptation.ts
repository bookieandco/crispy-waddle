import type { GrowthId } from '../domain/types.js';
import type { SocialPattern, SocialPlatform } from './social-intelligence.js';

export interface CreativeAdaptationRequest {
  readonly patternId: GrowthId;
  readonly platform: SocialPlatform;
  readonly objective: string;
  readonly audience: string;
  readonly productOrOffer?: string;
  readonly variantCount: number;
  readonly brandConstraints?: readonly string[];
}

export interface CreativeVariant {
  readonly id: GrowthId;
  readonly patternId: GrowthId;
  readonly platform: SocialPlatform;
  readonly objective: string;
  readonly audience: string;
  readonly productOrOffer?: string;
  readonly patternMechanics: readonly string[];
  readonly originalityRequirements: readonly string[];
  readonly experimentHypothesis: string;
  readonly provenance: readonly GrowthId[];
}

export function buildCreativeAdaptationPlan(
  request: CreativeAdaptationRequest,
  pattern: SocialPattern,
): readonly CreativeVariant[] {
  const count = Math.max(1, Math.min(10, Math.floor(request.variantCount)));
  const mechanics = [
    pattern.hook ? `hook:${pattern.hook}` : undefined,
    pattern.format ? `format:${pattern.format}` : undefined,
    pattern.structure ? `structure:${pattern.structure}` : undefined,
    pattern.emotionalDriver ? `emotion:${pattern.emotionalDriver}` : undefined,
    pattern.cta ? `cta:${pattern.cta}` : undefined,
  ].filter((value): value is string => Boolean(value));

  const originalityRequirements = [
    'Create original copy and creative assets.',
    'Do not reproduce source wording, imagery, or distinctive expression.',
    'Preserve the underlying pattern mechanics only.',
    ...(request.brandConstraints ?? []),
  ];

  return Array.from({ length: count }, (_, index) => ({
    id: `creative-adaptation:${pattern.id}:${index + 1}` as GrowthId,
    patternId: pattern.id,
    platform: request.platform,
    objective: request.objective,
    audience: request.audience,
    productOrOffer: request.productOrOffer,
    patternMechanics: mechanics,
    originalityRequirements,
    experimentHypothesis: `Applying the validated ${pattern.hook ?? 'content'} pattern to ${request.audience} on ${request.platform} will improve ${request.objective}. Variant ${index + 1} tests a distinct execution while preserving the underlying mechanism.`,
    provenance: [pattern.id],
  }));
}
