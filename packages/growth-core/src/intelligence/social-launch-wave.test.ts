import { describe, expect, it } from 'vitest';
import { compileSocialJuggernautPlan, type SocialPortfolioSubject } from './social-juggernaut.js';
import { compileSocialLaunchCampaign } from './social-launch-wave.js';

const subject: SocialPortfolioSubject = {
  id: 'subject:launch',
  kind: 'product',
  brandId: 'brand:pupsonstuff',
  label: 'New personalized pet product',
  audienceSignals: ['pet owner', 'gift buyer'],
  objectives: ['discovery', 'product_sale', 'direct_capture'],
  preferredSurfaces: ['social:instagram', 'social:tiktok', 'social:pinterest', 'search:google'],
  evidenceRefs: ['product:truth', 'audience:evidence'],
  scores: {
    businessValue: 90,
    evidenceQuality: 85,
    contentReadiness: 80,
    learningValue: 75,
    urgency: 95,
  },
};

describe('Social launch wave compiler', () => {
  it('turns one social plan into coordinated prelaunch, launch and momentum waves', () => {
    const plan = compileSocialJuggernautPlan(subject);
    const campaign = compileSocialLaunchCampaign({
      plan,
      launchAt: '2026-11-15T17:00:00.000Z',
      localization: ['en-US', 'es-US'],
      evidenceRefs: ['launch:brief'],
    });

    expect(campaign.waves.map((wave) => wave.phase)).toEqual([
      'strategic_prep',
      'asset_prep',
      'partner_prep',
      'content_prep',
      'final_confirm',
      'launch',
      'momentum',
    ]);
    expect(campaign.waves.find((wave) => wave.phase === 'launch')?.platformVariants.length)
      .toBe(plan.variants.length);
    expect(campaign.doctrine.simultaneousMultiChannel).toBe(true);
    expect(campaign.doctrine.progressiveDepth).toBe(true);
  });

  it('keeps all launch execution approval-bound', () => {
    const campaign = compileSocialLaunchCampaign({
      plan: compileSocialJuggernautPlan(subject),
      launchAt: '2026-11-15T17:00:00.000Z',
      evidenceRefs: ['launch:brief'],
    });

    expect(campaign.externalActionAuthorized).toBe(false);
    expect(campaign.waves.every((wave) => wave.requiresPublicationApproval)).toBe(true);
    expect(campaign.waves.every((wave) => wave.requiresOutreachApproval)).toBe(true);
    expect(campaign.waves.every((wave) => wave.requiresSpendApproval)).toBe(true);
  });

  it('propagates adjacent discovery surfaces without pretending Social can execute them', () => {
    const campaign = compileSocialLaunchCampaign({
      plan: compileSocialJuggernautPlan(subject),
      launchAt: '2026-11-15T17:00:00.000Z',
      evidenceRefs: ['launch:brief'],
    });

    expect(campaign.waves[0]?.adjacentSurfaces).toContain('search:google');
  });
});
