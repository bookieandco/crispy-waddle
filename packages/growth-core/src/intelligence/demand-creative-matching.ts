import type { GrowthId } from '../domain/types.js';
import type { BuyerOfferMatch } from './buyer-offer-matching.js';
import type { SocialPattern } from './social-intelligence.js';

export interface DemandCreativeInput {
  readonly buyerSignalId: GrowthId;
  readonly platform: string;
  readonly topic: string;
  readonly intentLevel: 'low' | 'medium' | 'high';
  readonly offer: BuyerOfferMatch;
  readonly pattern?: Pick<SocialPattern, 'id' | 'hook' | 'format' | 'structure' | 'confidence'>;
}

export interface CreativeBrief {
  readonly id: GrowthId;
  readonly buyerSignalId: GrowthId;
  readonly offerId: GrowthId;
  readonly platform: string;
  readonly objective: 'validate_demand' | 'drive_purchase_intent';
  readonly hookDirection: string;
  readonly formatDirection: string;
  readonly structureDirection: string;
  readonly originalityRequirements: readonly string[];
  readonly evidence: readonly GrowthId[];
}

export function buildDemandCreativeBrief(input: DemandCreativeInput): CreativeBrief {
  const pattern = input.pattern;
  const objective = input.intentLevel === 'high' ? 'drive_purchase_intent' : 'validate_demand';

  return {
    id: `creative-brief:${input.buyerSignalId}:${input.offer.offerId}` as GrowthId,
    buyerSignalId: input.buyerSignalId,
    offerId: input.offer.offerId,
    platform: input.platform,
    objective,
    hookDirection: pattern?.hook ? `Use the proven ${pattern.hook} mechanic without copying source creative.` : 'Lead with the buyer problem and clear product relevance.',
    formatDirection: pattern?.format ?? 'Use a native platform format appropriate to the audience.',
    structureDirection: pattern?.structure ?? 'Problem → product relevance → proof → clear next step.',
    originalityRequirements: ['Create original copy and visuals', 'Do not reproduce source creative', 'Preserve evidence provenance'],
    evidence: [input.buyerSignalId, input.offer.offerId, ...(pattern ? [pattern.id] : [])],
  };
}
