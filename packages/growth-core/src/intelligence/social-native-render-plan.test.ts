import { describe, expect, it } from 'vitest';
import { compileSocialJuggernautPlan, type SocialPortfolioSubject } from './social-juggernaut.js';
import { compileSocialNativeRenderPlan } from './social-native-render-plan.js';

const base: SocialPortfolioSubject = {
  id: 'subject:render',
  kind: 'product',
  brandId: 'brand:pupsonstuff',
  label: 'Pet art launch',
  audienceSignals: ['pet owner', 'gift buyer'],
  objectives: ['discovery', 'product_sale'],
  preferredSurfaces: ['social:instagram', 'social:pinterest', 'social:x'],
  evidenceRefs: ['product:truth'],
  scores: {
    businessValue: 85,
    evidenceQuality: 80,
    contentReadiness: 90,
    learningValue: 70,
    urgency: 70,
  },
};

describe('Social native render planning', () => {
  it('reuses existing video before asking Director to create new media', () => {
    const plan = compileSocialJuggernautPlan(base);
    const variant = plan.variants.find((item) =>
      item.platform === 'instagram' && item.format === 'short_video'
    )!;

    const render = compileSocialNativeRenderPlan({
      variant,
      sourceAssets: [{
        id: 'asset:existing-video',
        kind: 'video',
        uri: 'storage://existing.mp4',
        rightsEvidenceRefs: ['rights:owned'],
        immutableSourceHash: 'abc123',
      }],
      evidenceRefs: ['campaign:1'],
    });

    expect(render.path).toBe('REPACKAGE_EXISTING');
    expect(render.operations).toContain('trim');
    expect(render.operations).toContain('caption');
    expect(render.preserveSourceHashes).toBe(true);
  });

  it('creates card/pin plans without silently restyling source artwork', () => {
    const plan = compileSocialJuggernautPlan(base);
    const variant = plan.variants.find((item) => item.platform === 'pinterest')!;

    const render = compileSocialNativeRenderPlan({
      variant,
      sourceAssets: [{
        id: 'asset:art',
        kind: 'artwork',
        uri: 'storage://art.png',
        rightsEvidenceRefs: ['rights:owned-art'],
      }],
      evidenceRefs: ['campaign:1'],
    });

    expect(render.path).toBe('REPACKAGE_EXISTING');
    expect(render.operations).toContain('safe_frame');
    expect(render.operations).toContain('card_layout');
    expect(render.noArtworkRestyleWithoutSeparateCreativeAuthority).toBe(true);
  });

  it('keeps text-native surfaces out of unnecessary media generation', () => {
    const plan = compileSocialJuggernautPlan(base);
    const variant = plan.variants.find((item) =>
      item.platform === 'x' && item.format === 'text_post'
    )!;

    const render = compileSocialNativeRenderPlan({
      variant,
      evidenceRefs: ['campaign:1'],
    });

    expect(render.path).toBe('TEXT_ONLY');
    expect(render.requiresDirectorReview).toBe(false);
  });

  it('requires rights evidence for non-text source assets', () => {
    const plan = compileSocialJuggernautPlan(base);
    const variant = plan.variants.find((item) => item.platform === 'instagram')!;

    expect(() => compileSocialNativeRenderPlan({
      variant,
      sourceAssets: [{
        id: 'asset:unverified',
        kind: 'video',
        uri: 'https://example.test/video.mp4',
        rightsEvidenceRefs: [],
      }],
      evidenceRefs: ['campaign:1'],
    })).toThrow(/SOURCE_RIGHTS_REQUIRED/);
  });
});
