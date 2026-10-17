import { describe, expect, it } from 'vitest';
import {
  buildVentureOpportunity,
  type Opportunity,
  type VentureMarketSignal,
} from '@jhadina/opportunity-core';
import { businessFactoryVentureToSocialSubject } from './social-juggernaut-business-factory.js';
import { compileSocialJuggernautPlan } from './social-juggernaut.js';

const now = '2026-10-07T18:30:00.000Z';

const opportunity: Opportunity = {
  id: 'opportunity:pup-gift',
  title: 'Personalized pet gifts',
  family: 'business',
  type: 'commercial',
  sourceUrl: 'https://example.test/pup',
  sourceName: 'test',
  claims: [],
  evidence: [],
  verificationStatus: 'unverified',
  sourceConfidence: 0.8,
  riskFlags: [],
  status: 'discovered',
  createdAt: now,
  updatedAt: now,
};

const signals: VentureMarketSignal[] = [{
  id: 'signal:sales',
  kind: 'sales',
  sourceRef: 'market:sales',
  observedAt: now,
  value: 100,
  unit: 'orders',
  note: 'Observed paid demand',
  confidence: 0.8,
}];

function venture() {
  return buildVentureOpportunity({
    opportunity,
    family: 'pod_personalized_commerce',
    demandThesis: {
      buyer: 'Pet owner buying a personal gift',
      jobToBeDone: 'Turn a pet photo into a memorable product',
      paidProblem: 'Generic pet gifts do not feel personal',
      marketMechanic: 'Personalization plus emotional attachment',
      unmetAngles: ['memorial', 'birthday', 'multi-pet household'],
      disconfirmingEvidence: [],
      evidenceRefs: ['evidence:demand'],
    },
    signals,
    unitEconomics: { currency: 'USD' },
    scoreFactors: {
      demandProof: 86,
      grossMarginPotential: 78,
      automationPotential: 92,
      competitionHeadroom: 70,
      differentiation: 80,
      startupEfficiency: 85,
      timeToEvidence: 90,
      repeatability: 88,
      legalPlatformSafety: 92,
      crossJhadinaLeverage: 95,
    },
    makeSense: {
      coherence: 90,
      causalLogic: 88,
      chronology: 85,
      incentives: 90,
      baseRates: 80,
      contradictionHandling: 84,
      alternativesConsidered: 82,
      evidenceQuality: 86,
      notes: ['Evidence supports the buyer/problem thesis.'],
      evidenceRefs: ['evidence:make-sense'],
    },
    originalityInput: {
      marketMechanics: ['personalized pet gifting'],
      competitorArtifactRefs: [],
      proposedCreative: 'Original pet identity and product system',
      evidenceRefs: ['evidence:originality'],
    },
    evidenceRefs: ['evidence:venture'],
    createdAt: now,
  });
}

describe('Business Factory -> Social Juggernaut bridge', () => {
  it('turns canonical venture truth into a social subject without execution authority', () => {
    const subject = businessFactoryVentureToSocialSubject({
      venture: venture(),
      brandId: 'brand:pupsonstuff',
      objectives: ['discovery', 'product_sale', 'direct_capture'],
      contentReadiness: 85,
      urgency: 70,
    });

    expect(subject.kind).toBe('venture');
    expect(subject.audienceSignals.join(' ')).toMatch(/Pet owner/);
    expect(subject.preferredSurfaces).toContain('social:instagram');
    expect(subject.preferredSurfaces).toContain('social:tiktok');

    const plan = compileSocialJuggernautPlan(subject);
    expect(plan.publicationAuthority).toBe('NONE');
    expect(plan.messagingAuthority).toBe('NONE');
    expect(plan.paidMediaAuthority).toBe('NONE');
  });

  it('inherits a validated winning mechanic only when evidence is present', () => {
    const subject = businessFactoryVentureToSocialSubject({
      venture: venture(),
      brandId: 'brand:pupsonstuff',
      objectives: ['discovery', 'product_sale'],
      contentReadiness: 90,
      urgency: 80,
      validatedWinningMechanic: {
        id: 'winner:pet-reveal',
        evidenceRefs: ['experiment:pet-reveal:replicated'],
      },
    });

    expect(compileSocialJuggernautPlan(subject).mode).toBe('ATTACK');
  });

  it('can use explicit social surfaces for a venture that is not yet in the brand registry', () => {
    const subject = businessFactoryVentureToSocialSubject({
      venture: venture(),
      brandId: 'brand:new-venture',
      objectives: ['lead_generation'],
      preferredSurfaces: ['social:linkedin', 'social:x'],
      contentReadiness: 60,
      urgency: 50,
    });

    expect(subject.preferredSurfaces).toEqual(['social:linkedin', 'social:x']);
  });
});
