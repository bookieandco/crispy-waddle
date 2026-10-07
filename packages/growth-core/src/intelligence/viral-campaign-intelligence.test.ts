import { describe, expect, it } from 'vitest';
import type { GrowthId } from '../domain/types.js';
import {
  createSocialCommercialCampaignEnvelope,
} from './social-commercial-campaign.js';
import {
  bindPupsonStuffSocialCommerce,
} from './social-commercial-lineage.js';
import {
  compileSocialJuggernautPlan,
  type SocialPortfolioSubject,
} from './social-juggernaut.js';
import {
  compileViralCampaignHypothesis,
  evaluateViralCampaignEvidence,
  selectViralSeedCohorts,
  type ViralCampaignObservation,
  type ViralSeedCohort,
} from './viral-campaign-intelligence.js';

function subject(attack = false): SocialPortfolioSubject {
  return {
    id: 'subject:pupsonstuff:viral' as GrowthId,
    kind: 'product',
    brandId: 'brand:pupsonstuff' as GrowthId,
    label: 'PupsonStuff personalized products',
    audienceSignals: ['pet owner', 'gift buyer', 'dog', 'personalized gift'],
    objectives: ['discovery', 'product_sale'],
    preferredSurfaces: ['social:instagram'],
    evidenceRefs: ['product:truth', 'brand:pupsonstuff'],
    scores: {
      businessValue: 92,
      evidenceQuality: 88,
      contentReadiness: 90,
      learningValue: 86,
      urgency: 80,
    },
    ...(attack
      ? {
          validatedWinningMechanic: {
            id: 'winner:replicated-share-mechanic',
            evidenceRefs: ['replication:1', 'replication:2'],
          },
        }
      : {}),
  };
}

function campaign(attack = false) {
  const plan = compileSocialJuggernautPlan(subject(attack));
  const binding = bindPupsonStuffSocialCommerce({
    id: 'binding:pupsonstuff:instagram',
    subjectId: plan.subjectId,
    socialAccountRef: 'social-account:pupsonstuff:instagram',
    platform: 'instagram',
    storefrontRef: 'storefront:pupsonstuff',
    checkoutRef: 'checkout:pupsonstuff',
    productRefs: ['product:pupsonstuff:portrait'],
    catalogEvidenceRefs: ['catalog:pupsonstuff'],
    commerceEvidenceRefs: ['commerce:pupsonstuff'],
  });

  return createSocialCommercialCampaignEnvelope({
    id: 'commercial-campaign:pupsonstuff:viral' as GrowthId,
    plan,
    binding,
    evidenceRefs: ['campaign:commercial-lineage'],
    createdAt: '2026-10-07T18:00:00.000Z',
  });
}

const seeds: ViralSeedCohort[] = [
  {
    id: 'seed:pet-creators-a',
    clusterId: 'cluster:pet-creators',
    label: 'Pet creator audience A',
    audienceFit: 96,
    bridgePotential: 90,
    trust: 90,
    activationReadiness: 92,
    estimatedReach: 40_000,
    evidenceRefs: ['audience:pet-creators:a'],
  },
  {
    id: 'seed:pet-creators-b',
    clusterId: 'cluster:pet-creators',
    label: 'Pet creator audience B',
    audienceFit: 95,
    bridgePotential: 89,
    trust: 89,
    activationReadiness: 90,
    estimatedReach: 50_000,
    evidenceRefs: ['audience:pet-creators:b'],
  },
  {
    id: 'seed:gift-buyers',
    clusterId: 'cluster:gift-buyers',
    label: 'Personalized gift buyers',
    audienceFit: 88,
    bridgePotential: 84,
    trust: 86,
    activationReadiness: 85,
    estimatedReach: 30_000,
    evidenceRefs: ['audience:gift-buyers'],
  },
  {
    id: 'seed:dog-community',
    clusterId: 'cluster:dog-community',
    label: 'Dog community',
    audienceFit: 91,
    bridgePotential: 80,
    trust: 88,
    activationReadiness: 82,
    estimatedReach: 25_000,
    evidenceRefs: ['audience:dog-community'],
  },
];

function signals() {
  return {
    novelty: 88,
    emotionalResonance: 82,
    utility: 70,
    identityResonance: 90,
    participationEase: 84,
    timeliness: 75,
    proofStrength: 78,
    discussionPotential: 86,
  };
}

describe('Viral Campaign Intelligence', () => {
  it('treats virality as a governed testable hypothesis rather than a promise', () => {
    const hypothesis = compileViralCampaignHypothesis({
      id: 'viral:pupsonstuff:challenge' as GrowthId,
      campaign: campaign(false),
      mechanic: 'participation_challenge',
      shareMotives: ['participation', 'identity', 'humor'],
      signals: signals(),
      seedCohorts: seeds,
      evidenceRefs: ['creative:worst-pet-photo-challenge'],
      evaluatedAt: '2026-10-07T18:30:00.000Z',
    });

    expect(hypothesis.phase).toBe('SEARCH');
    expect(hypothesis.testDecision).toBe('TEST');
    expect(hypothesis.policy.viralityIsProbabilityNotPromise).toBe(true);
    expect(hypothesis.policy.guaranteedViralityClaimAllowed).toBe(false);
    expect(hypothesis.policy.concealedBrandDeceptionAllowed).toBe(false);
    expect(hypothesis.policy.spamSeedingAllowed).toBe(false);
    expect(hypothesis.publicationAuthority).toBe('NONE');
    expect(hypothesis.outreachAuthority).toBe('NONE');
  });

  it('diversifies initial seeding across independent audience clusters', () => {
    const plan = selectViralSeedCohorts({
      cohorts: seeds,
      maxCohorts: 3,
    });

    expect(plan.selected).toHaveLength(3);
    expect(new Set(plan.selected.map((item) => item.clusterId)).size).toBe(3);
    expect(plan.selected.filter((item) =>
      item.clusterId === 'cluster:pet-creators'
    )).toHaveLength(1);
    expect(plan.strategy).toBe('DIVERSE_BRIDGES_OVER_SINGLE_CLUSTER');
    expect(plan.externalActionAuthorized).toBe(false);
  });

  it('does not let one giant spike prove a viral strategy', () => {
    const observation: ViralCampaignObservation = {
      id: 'viral-observation:one-spike',
      variantId: 'variant:one',
      views: 2_000_000,
      shares: 240_000,
      qualifiedOutcomes: 500,
      baselineShareRate: 0.01,
      independentClusterIds: ['cluster:pet-creators'],
      earnedMediaMentions: 100,
      observedAt: '2026-10-07T19:00:00.000Z',
      evidenceRefs: ['provider:post:one', 'commerce:orders:one'],
    };

    const evaluation = evaluateViralCampaignEvidence([observation]);

    expect(evaluation.status).toBe('candidate');
    expect(evaluation.eligibleForAttack).toBe(false);
    expect(evaluation.replicatedVariantCount).toBe(1);
    expect(evaluation.law).toBe('ONE_SPIKE_IS_NOT_VIRAL_STRATEGY_PROOF');
  });

  it('opens ATTACK only after replicated above-baseline sharing across independent clusters plus qualified outcomes', () => {
    const commercial = campaign(true);
    const variants = commercial.routes.map((route) => route.variantId);
    expect(variants.length).toBeGreaterThanOrEqual(2);

    const observations: ViralCampaignObservation[] = [
      {
        id: 'viral-observation:a',
        variantId: variants[0]!,
        views: 20_000,
        shares: 1_600,
        saves: 900,
        qualifiedOutcomes: 45,
        baselineShareRate: 0.03,
        independentClusterIds: ['cluster:pet-creators'],
        observedAt: '2026-10-07T19:00:00.000Z',
        evidenceRefs: ['post:a', 'orders:a'],
      },
      {
        id: 'viral-observation:b',
        variantId: variants[1]!,
        views: 16_000,
        shares: 1_120,
        saves: 700,
        qualifiedOutcomes: 31,
        baselineShareRate: 0.025,
        independentClusterIds: ['cluster:gift-buyers'],
        observedAt: '2026-10-07T20:00:00.000Z',
        evidenceRefs: ['post:b', 'orders:b'],
      },
    ];

    const hypothesis = compileViralCampaignHypothesis({
      id: 'viral:pupsonstuff:attack' as GrowthId,
      campaign: commercial,
      mechanic: 'humor_surprise',
      shareMotives: ['humor', 'identity', 'surprise'],
      signals: signals(),
      seedCohorts: seeds,
      observations,
      evidenceRefs: ['experiment:replicated'],
      evaluatedAt: '2026-10-07T20:30:00.000Z',
    });

    expect(hypothesis.evidenceEvaluation.status).toBe('validated');
    expect(hypothesis.evidenceEvaluation.independentClusterCount).toBe(2);
    expect(hypothesis.evidenceEvaluation.qualifiedOutcomeCount).toBe(76);
    expect(hypothesis.phase).toBe('ATTACK');
  });

  it('supports fast moment-response planning without granting automatic publishing', () => {
    const hypothesis = compileViralCampaignHypothesis({
      id: 'viral:pupsonstuff:moment' as GrowthId,
      campaign: campaign(false),
      mechanic: 'moment_response',
      shareMotives: ['conversation', 'humor', 'surprise'],
      signals: { ...signals(), timeliness: 98 },
      seedCohorts: seeds,
      moment: {
        sourceRef: 'radar:moment:super-bowl-blackout-style-event',
        detectedAt: '2026-10-07T18:00:00.000Z',
        expiresAt: '2026-10-07T19:00:00.000Z',
        brandFit: 90,
        assetReadiness: 95,
        rightsReady: true,
        evidenceRefs: ['radar:moment:evidence'],
      },
      evidenceRefs: ['moment:creative-brief'],
      evaluatedAt: '2026-10-07T18:20:00.000Z',
    });

    expect(hypothesis.momentState).toBe('active');
    expect(hypothesis.testDecision).toBe('TEST');
    expect(hypothesis.externalActionAuthorized).toBe(false);
  });

  it('holds expired moments instead of posting late just because the concept scored well', () => {
    const hypothesis = compileViralCampaignHypothesis({
      id: 'viral:pupsonstuff:expired' as GrowthId,
      campaign: campaign(false),
      mechanic: 'moment_response',
      shareMotives: ['conversation', 'humor'],
      signals: { ...signals(), timeliness: 99 },
      seedCohorts: seeds,
      moment: {
        sourceRef: 'radar:moment:expired',
        detectedAt: '2026-10-07T17:00:00.000Z',
        expiresAt: '2026-10-07T18:00:00.000Z',
        brandFit: 95,
        assetReadiness: 95,
        rightsReady: true,
        evidenceRefs: ['radar:expired:evidence'],
      },
      evidenceRefs: ['moment:expired'],
      evaluatedAt: '2026-10-07T18:30:00.000Z',
    });

    expect(hypothesis.momentState).toBe('expired');
    expect(hypothesis.testDecision).toBe('HOLD');
  });

  it('requires a commercial route before viral planning can exist', () => {
    const broken = {
      ...campaign(false),
      routes: [],
    };

    expect(() => compileViralCampaignHypothesis({
      id: 'viral:orphan' as GrowthId,
      campaign: broken,
      mechanic: 'curiosity_reveal',
      shareMotives: ['curiosity'],
      signals: signals(),
      seedCohorts: seeds,
      evidenceRefs: ['creative:orphan'],
      evaluatedAt: '2026-10-07T18:30:00.000Z',
    })).toThrow(/COMMERCIAL_ROUTE_REQUIRED/);
  });
});
