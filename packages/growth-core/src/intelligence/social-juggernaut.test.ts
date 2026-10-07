import { describe, expect, it } from 'vitest';
import {
  compileSocialJuggernautPlan,
  rankSocialPortfolio,
  type SocialPortfolioSubject,
} from './social-juggernaut.js';

function subject(overrides: Partial<SocialPortfolioSubject> = {}): SocialPortfolioSubject {
  return {
    id: 'subject:atwood-bookie',
    kind: 'music',
    brandId: 'brand:atwood-bookie',
    label: 'Atwood Bookie catalog',
    audienceSignals: ['hip hop', 'rap', 'Detroit', 'music'],
    objectives: ['discovery', 'music_transfer', 'direct_capture'],
    preferredSurfaces: [
      'social:instagram',
      'social:tiktok',
      'social:youtube',
      'social:x',
      'creator:network',
    ],
    evidenceRefs: ['music:catalog', 'growth:audience'],
    scores: {
      businessValue: 82,
      evidenceQuality: 78,
      contentReadiness: 85,
      learningValue: 90,
      urgency: 70,
    },
    ...overrides,
  };
}

describe('Social Juggernaut portfolio planner', () => {
  it('compiles one portfolio subject into native multi-platform lanes without granting execution authority', () => {
    const plan = compileSocialJuggernautPlan(subject());

    expect(plan.mode).toBe('SEARCH');
    expect(plan.adjacentSurfaces).toEqual(['creator:network']);
    expect(new Set(plan.variants.map((variant) => variant.platform))).toEqual(
      new Set(['instagram', 'tiktok', 'youtube', 'x']),
    );
    expect(new Set(plan.variants.map((variant) => variant.lane))).toEqual(
      new Set(['reach_engine', 'relationship', 'conversion']),
    );

    expect(plan.variants.find((variant) =>
      variant.platform === 'instagram' && variant.lane === 'reach_engine'
    )?.format).toBe('short_video');
    expect(plan.variants.find((variant) =>
      variant.platform === 'instagram' && variant.lane === 'relationship'
    )?.format).toBe('story');
    expect(plan.variants.find((variant) =>
      variant.platform === 'x' && variant.lane === 'reach_engine'
    )?.format).toBe('text_post');

    expect(plan.operatingPolicy).toMatchObject({
      reuseBeforeCreate: true,
      sourceSafeMedia: true,
      nativeVariantsInsteadOfBlindCrossPost: true,
      consentRequiredForDirectCapture: true,
    });
    expect(plan.publicationAuthority).toBe('NONE');
    expect(plan.messagingAuthority).toBe('NONE');
    expect(plan.paidMediaAuthority).toBe('NONE');
  });

  it('treats follower count as diagnostic and qualified outcomes as primary', () => {
    const plan = compileSocialJuggernautPlan(subject());

    expect(plan.measurement.primary).toContain('direct_captures');
    expect(plan.measurement.primary).toContain('orders');
    expect(plan.measurement.primary).toContain('revenue');
    expect(plan.measurement.diagnostics).toContain('followers');
    expect(plan.measurement.law).toBe('QUALIFIED_BUSINESS_OUTCOMES_OVER_VANITY');
  });

  it('moves to ATTACK only when a validated winning mechanic carries evidence', () => {
    const plan = compileSocialJuggernautPlan(subject({
      validatedWinningMechanic: {
        id: 'winner:story-hook-01',
        evidenceRefs: ['experiment:replication:1', 'experiment:replication:2'],
      },
    }));

    expect(plan.mode).toBe('ATTACK');
    expect(plan.variants[0]?.evidenceRefs).toContain('experiment:replication:1');
  });

  it('keeps risky stealth-growth mechanics outside the production plan', () => {
    const plan = compileSocialJuggernautPlan(subject());

    expect(plan.operatingPolicy.blockedAutomation).toContain('follow_unfollow');
    expect(plan.operatingPolicy.blockedAutomation).toContain('bulk_account_creation');
    expect(plan.operatingPolicy.blockedAutomation).toContain('credential_cookie_scraping');
    expect(plan.operatingPolicy.blockedAutomation).toContain('proxy_evasion');
    expect(plan.operatingPolicy.blockedAutomation).toContain('mass_unsolicited_engagement');
  });

  it('can plan Pinterest as a desired native surface without pretending publication authority exists', () => {
    const plan = compileSocialJuggernautPlan(subject({
      kind: 'product',
      objectives: ['discovery', 'product_sale'],
      preferredSurfaces: ['social:pinterest'],
    }));

    expect(plan.variants.find((variant) => variant.platform === 'pinterest')?.format).toBe('pin');
    expect(plan.publicationAuthority).toBe('NONE');
  });

  it('ranks businesses by business value, evidence, readiness and learning leverage', () => {
    const ranked = rankSocialPortfolio([
      subject({
        id: 'subject:low',
        scores: {
          businessValue: 40,
          evidenceQuality: 50,
          contentReadiness: 50,
          learningValue: 40,
          urgency: 30,
        },
      }),
      subject({
        id: 'subject:high',
        scores: {
          businessValue: 95,
          evidenceQuality: 90,
          contentReadiness: 90,
          learningValue: 85,
          urgency: 80,
        },
      }),
    ]);

    expect(ranked[0]?.subjectId).toBe('subject:high');
    expect(ranked[0]?.priority).toBe('high');
    expect(ranked[1]?.subjectId).toBe('subject:low');
  });

  it('fails closed when evidence or social surfaces are missing', () => {
    expect(() => compileSocialJuggernautPlan(subject({
      evidenceRefs: [],
    }))).toThrow(/EVIDENCE_REQUIRED/);

    expect(() => compileSocialJuggernautPlan(subject({
      preferredSurfaces: ['email', 'web:owned'],
    }))).toThrow(/SOCIAL_SURFACE_REQUIRED/);
  });
});
