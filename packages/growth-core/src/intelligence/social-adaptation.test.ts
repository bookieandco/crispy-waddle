import { describe, expect, it } from 'vitest';
import { buildCreativeAdaptationPlan } from './social-adaptation.js';

const pattern = {
  id: 'social-pattern:1' as never,
  sourceObservationIds: ['obs-1' as never],
  platforms: ['instagram'] as const,
  topic: 'pet portraits',
  hook: 'numbered',
  format: 'short-video',
  structure: 'numbered-list',
  visualPattern: 'video-led',
  emotionalDriver: 'curiosity',
  cta: 'shop',
  audienceSignals: ['pet lovers'],
  confidence: 0.9,
};

describe('social adaptation', () => {
  it('creates bounded original variants from pattern mechanics', () => {
    const variants = buildCreativeAdaptationPlan({
      patternId: pattern.id,
      platform: 'tiktok',
      objective: 'increase qualified clicks',
      audience: 'pet owners',
      productOrOffer: 'custom pet portrait',
      variantCount: 3,
    }, pattern);

    expect(variants).toHaveLength(3);
    expect(variants[0].patternMechanics).toEqual(expect.arrayContaining(['hook:numbered', 'format:short-video']));
    expect(variants[0].originalityRequirements).toEqual(expect.arrayContaining([
      'Create original copy and creative assets.',
      'Do not reproduce source wording, imagery, or distinctive expression.',
    ]));
    expect(variants[0].provenance).toContain(pattern.id);
  });

  it('caps requested variants to prevent runaway generation', () => {
    expect(buildCreativeAdaptationPlan({
      patternId: pattern.id,
      platform: 'instagram',
      objective: 'test',
      audience: 'audience',
      variantCount: 100,
    }, pattern)).toHaveLength(10);
  });
});
