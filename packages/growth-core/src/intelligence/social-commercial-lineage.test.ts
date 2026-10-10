import { describe, expect, it } from 'vitest';
import {
  summarizeSideHustleAffiliatePortfolio,
  type OwnedMediaProperty,
  type SideHustleAffiliateEvent,
} from '@jhadina/opportunity-core';
import {
  compileSocialJuggernautPlan,
  type SocialPortfolioSubject,
} from './social-juggernaut.js';
import { createSocialCampaignRun } from './social-campaign-runtime.js';
import {
  bindBrandSocialCommerce,
  bindFacelessYouTubeAffiliate,
  bindFacelessYouTubeAffiliatePortfolio,
  bindPupsonStuffSocialCommerce,
  compileSocialCommercialRoutes,
  createAffiliateCommercialOutcomeLineage,
  createPupsonStuffOrderOutcomeLineage,
  createSocialCommercialOutcomeLineage,
  socialCommercialAffiliateMetadata,
} from './social-commercial-lineage.js';

const youtubeSubject: SocialPortfolioSubject = {
  id: 'subject:faceless:buyer-guides',
  kind: 'owned_media',
  brandId: 'brand:buyer-guides',
  label: 'Buyer Guides faceless YouTube',
  audienceSignals: ['buyer intent', 'comparison', 'product research'],
  objectives: ['discovery', 'qualified_traffic'],
  preferredSurfaces: ['social:youtube'],
  evidenceRefs: ['owned-media:niche-proof'],
  scores: {
    businessValue: 86,
    evidenceQuality: 82,
    contentReadiness: 90,
    learningValue: 88,
    urgency: 70,
  },
};

const ownedProperty: OwnedMediaProperty = {
  id: 'owned-property:youtube:buyer-guides',
  opportunityId: 'opportunity:owned-media:buyer-guides',
  family: 'owned_media',
  propertyType: 'youtube_channel',
  label: 'Buyer Guides',
  providerRef: 'youtube:channel:abc',
  evidenceRefs: ['youtube:channel:verified'],
  status: 'active',
  createdAt: '2026-10-07T18:00:00.000Z',
  updatedAt: '2026-10-07T18:00:00.000Z',
  authority: 'OWNED_MEDIA_REGISTRY_ONLY',
  externalActionAuthorized: false,
  publishingAuthorized: false,
  moneyMovementAuthorized: false,
};

const pupSubject: SocialPortfolioSubject = {
  id: 'subject:pupsonstuff:instagram',
  kind: 'product',
  brandId: 'brand:pupsonstuff',
  label: 'PupsonStuff Instagram commerce',
  audienceSignals: ['pet owner', 'personalized gift', 'dog'],
  objectives: ['discovery', 'product_sale', 'direct_capture'],
  preferredSurfaces: ['social:instagram'],
  evidenceRefs: ['brand:pupsonstuff', 'product:truth:pupsonstuff'],
  scores: {
    businessValue: 92,
    evidenceQuality: 90,
    contentReadiness: 88,
    learningValue: 80,
    urgency: 78,
  },
};


function affiliateEvent(
  input: Partial<SideHustleAffiliateEvent>
    & Pick<SideHustleAffiliateEvent, 'id' | 'externalEventRef' | 'kind'>,
): SideHustleAffiliateEvent {
  return {
    opportunityId: 'opportunity:affiliate:camera-kit',
    family: 'commerce_affiliate',
    programRef: 'program:camera-kit',
    providerRef: 'provider:partnerize',
    evidenceRefs: [`evidence:${input.id}`],
    occurredAt: '2026-10-07T19:00:00.000Z',
    authority: 'AFFILIATE_OBSERVATION_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
    moneyMovementAuthorized: false,
    ...input,
  };
}

const affiliateEvents: SideHustleAffiliateEvent[] = [
  affiliateEvent({
    id: 'affiliate:click:camera-kit',
    externalEventRef: 'partnerize:click:camera-kit',
    kind: 'click',
  }),
  affiliateEvent({
    id: 'affiliate:conversion:camera-kit',
    externalEventRef: 'partnerize:conversion:camera-kit',
    kind: 'conversion',
    economicState: 'approved',
    amount: 42,
    currency: 'USD',
  }),
  affiliateEvent({
    id: 'affiliate:payout:camera-kit',
    externalEventRef: 'partnerize:payout:camera-kit',
    kind: 'payout',
    economicState: 'paid',
    amount: 42,
    currency: 'USD',
  }),
];

describe('Social commercial lineage', () => {
  it('binds faceless YouTube content to an affiliate program with disclosure and durable routing', () => {
    const plan = compileSocialJuggernautPlan(youtubeSubject);
    const binding = bindFacelessYouTubeAffiliate({
      id: 'binding:buyer-guides:affiliate',
      subjectId: youtubeSubject.id,
      brandId: youtubeSubject.brandId,
      ownedMediaProperty: ownedProperty,
      youtubeAccountRef: 'social-account:youtube:buyer-guides',
      affiliateOpportunityId: 'opportunity:affiliate:merchant-x',
      affiliateProgramRef: 'partnerize:program:merchant-x',
      affiliateProviderRef: 'provider:partnerize',
      destinationRef: 'tracking-destination:merchant-x',
      disclosureRef: 'disclosure:affiliate-standard-v1',
      evidenceRefs: ['affiliate:terms:verified'],
    });

    const routes = compileSocialCommercialRoutes({ plan, binding });

    expect(routes.length).toBe(plan.variants.length);
    expect(new Set(routes.map((route) => route.platform))).toEqual(new Set(['youtube']));
    expect(routes.every((route) => route.destinationKind === 'affiliate_program')).toBe(true);
    expect(routes.every((route) => route.disclosureRequired)).toBe(true);
    expect(routes.every((route) => route.disclosureRef === 'disclosure:affiliate-standard-v1')).toBe(true);
    expect(binding.propertyRef).toBe(ownedProperty.id);
    expect(binding.policy.realizedRevenueRequiresProviderFinancialEvidence).toBe(true);
  });

  it('carries the same affiliate lineage key from publication through click, conversion, and realized revenue', () => {
    const plan = compileSocialJuggernautPlan(youtubeSubject);
    const binding = bindFacelessYouTubeAffiliate({
      id: 'binding:buyer-guides:affiliate',
      subjectId: youtubeSubject.id,
      brandId: youtubeSubject.brandId,
      ownedMediaProperty: ownedProperty,
      youtubeAccountRef: 'social-account:youtube:buyer-guides',
      affiliateOpportunityId: 'opportunity:affiliate:merchant-x',
      affiliateProgramRef: 'partnerize:program:merchant-x',
      affiliateProviderRef: 'provider:partnerize',
      destinationRef: 'tracking-destination:merchant-x',
      disclosureRef: 'disclosure:affiliate-standard-v1',
      evidenceRefs: ['affiliate:terms:verified'],
    });
    const route = compileSocialCommercialRoutes({ plan, binding })[0]!;

    const lineage = createSocialCommercialOutcomeLineage({
      route,
      publicationRef: 'youtube:video:published-123',
      clickOrSessionRef: 'affiliate:click:session-456',
      conversionRef: 'partnerize:conversion:789',
      revenueRef: 'partnerize:payout:item-101',
      evidenceRefs: [
        'youtube:publication-receipt',
        'partnerize:conversion-evidence',
        'partnerize:paid-payout-evidence',
      ],
    });

    expect(lineage.state).toBe('realized_revenue');
    expect(lineage.law).toBe('NEVER_SKIP_FROM_ATTENTION_TO_REVENUE');

    const metadata = socialCommercialAffiliateMetadata(lineage);
    expect(metadata.social_lineage_key).toBe(route.lineageKey);
    expect(metadata.social_publication_ref).toBe('youtube:video:published-123');
    expect(metadata.social_click_or_session_ref).toBe('affiliate:click:session-456');
    expect(metadata.social_conversion_ref).toBe('partnerize:conversion:789');
  });

  it('binds a PupsonStuff Instagram account directly to its commerce destination', () => {
    const plan = compileSocialJuggernautPlan(pupSubject);
    const binding = bindBrandSocialCommerce({
      id: 'binding:pupsonstuff:instagram',
      subjectId: pupSubject.id,
      brandId: pupSubject.brandId,
      ownerRef: 'venture:pupsonstuff',
      platform: 'instagram',
      socialAccountRef: 'social-account:pupsonstuff:instagram',
      destination: {
        label: 'PupsonStuff personalized products',
        destinationRef: 'storefront:pupsonstuff',
        offerRef: 'offer:pupsonstuff:personalized',
        productRef: 'catalog:pupsonstuff',
        evidenceRefs: ['commerce:pupsonstuff:catalog', 'storefront:pupsonstuff:live'],
      },
      evidenceRefs: ['brand:pupsonstuff', 'venture:pupsonstuff'],
    });

    const routes = compileSocialCommercialRoutes({ plan, binding });

    expect(routes.length).toBe(plan.variants.length);
    expect(routes.every((route) => route.platform === 'instagram')).toBe(true);
    expect(routes.every((route) => route.accountRef === 'social-account:pupsonstuff:instagram')).toBe(true);
    expect(routes.every((route) => route.destinationRef === 'storefront:pupsonstuff')).toBe(true);
    expect(routes.every((route) => route.destinationKind === 'commerce_offer')).toBe(true);
  });

  it('does not allow revenue to appear without conversion or conversion without a click/session', () => {
    const plan = compileSocialJuggernautPlan(pupSubject);
    const binding = bindBrandSocialCommerce({
      id: 'binding:pupsonstuff:instagram',
      subjectId: pupSubject.id,
      brandId: pupSubject.brandId,
      ownerRef: 'venture:pupsonstuff',
      platform: 'instagram',
      socialAccountRef: 'social-account:pupsonstuff:instagram',
      destination: {
        label: 'PupsonStuff store',
        destinationRef: 'storefront:pupsonstuff',
        offerRef: 'offer:pupsonstuff',
        evidenceRefs: ['commerce:pupsonstuff'],
      },
      evidenceRefs: ['brand:pupsonstuff'],
    });
    const route = compileSocialCommercialRoutes({ plan, binding })[0]!;

    expect(() => createSocialCommercialOutcomeLineage({
      route,
      publicationRef: 'instagram:post:1',
      revenueRef: 'order:1',
      evidenceRefs: ['order:evidence'],
    })).toThrow(/REVENUE_REQUIRES_CONVERSION/);

    expect(() => createSocialCommercialOutcomeLineage({
      route,
      publicationRef: 'instagram:post:1',
      conversionRef: 'order:1',
      evidenceRefs: ['order:evidence'],
    })).toThrow(/CONVERSION_REQUIRES_CLICK_OR_SESSION/);
  });

  it('fails closed when a plan is attached to the wrong business binding', () => {
    const binding = bindBrandSocialCommerce({
      id: 'binding:pupsonstuff:instagram',
      subjectId: pupSubject.id,
      brandId: pupSubject.brandId,
      ownerRef: 'venture:pupsonstuff',
      platform: 'instagram',
      socialAccountRef: 'social-account:pupsonstuff:instagram',
      destination: {
        label: 'PupsonStuff store',
        destinationRef: 'storefront:pupsonstuff',
        evidenceRefs: ['commerce:pupsonstuff'],
      },
      evidenceRefs: ['brand:pupsonstuff'],
    });

    expect(() => compileSocialCommercialRoutes({
      plan: compileSocialJuggernautPlan(youtubeSubject),
      binding,
    })).toThrow(/SUBJECT_MISMATCH/);
  });  it('binds a faceless YouTube campaign to canonical affiliate portfolio truth and payout evidence', () => {
    const portfolio = summarizeSideHustleAffiliatePortfolio(affiliateEvents);
    const plan = compileSocialJuggernautPlan(youtubeSubject);
    const binding = bindFacelessYouTubeAffiliatePortfolio({
      id: 'binding:buyer-guides:portfolio',
      subjectId: youtubeSubject.id,
      brandId: youtubeSubject.brandId,
      ownedMediaProperty: ownedProperty,
      youtubeAccountRef: 'social-account:youtube:buyer-guides',
      affiliatePortfolio: portfolio,
      destinations: {
        'program:camera-kit': {
          destinationRef: 'affiliate-destination:camera-kit',
          disclosureRef: 'disclosure:affiliate:camera-kit',
        },
      },
      evidenceRefs: ['affiliate:portfolio:verified'],
    });

    const route = compileSocialCommercialRoutes({ plan, binding })[0]!;
    expect(route.programRef).toBe('program:camera-kit');
    expect(route.providerRef).toBe('provider:partnerize');

    const lineage = createAffiliateCommercialOutcomeLineage({
      route,
      publicationRef: 'youtube:video:camera-guide',
      clickOrSessionRef: 'affiliate:session:camera-guide',
      affiliateEvents,
      evidenceRefs: ['attribution:youtube-to-affiliate'],
    });

    expect(lineage.state).toBe('realized_revenue');
    expect(lineage.conversionRef).toBe('partnerize:conversion:camera-kit');
    expect(lineage.revenueRef).toBe('partnerize:payout:camera-kit');

    const run = createSocialCampaignRun({
      id: 'social-run:buyer-guides:1',
      plan,
      destinationSetRefs: [binding.id],
      createdAt: '2026-10-07T19:00:00.000Z',
    });
    expect(run.destinationSetRefs).toEqual(['binding:buyer-guides:portfolio']);
  });

  it('binds PupsonStuff Instagram to exact products and carries order/payment lineage', () => {
    const plan = compileSocialJuggernautPlan(pupSubject);
    const binding = bindPupsonStuffSocialCommerce({
      id: 'binding:pupsonstuff:instagram:catalog',
      subjectId: pupSubject.id,
      socialAccountRef: 'social-account:pupsonstuff:instagram',
      platform: 'instagram',
      storefrontRef: 'pupsonstuff:storefront',
      checkoutRef: 'pupsonstuff:checkout',
      productRefs: ['frame1', 'mugWhite'],
      catalogEvidenceRefs: ['pupson:catalog:certified'],
      commerceEvidenceRefs: ['pupson:stripe-order-ledger'],
    });

    const product = binding.destinations.find(
      (destination) => destination.productRef === 'frame1',
    )!;
    const variant = plan.variants.find(
      (candidate) => candidate.platform === 'instagram',
    )!;
    const route = compileSocialCommercialRoutes({
      plan,
      binding,
      destinationByVariant: {
        [variant.id]: product.id,
      },
    }).find((candidate) => candidate.variantId === variant.id)!;

    expect(route.destinationKind).toBe('product');
    expect(route.productRef).toBe('frame1');

    const lineage = createPupsonStuffOrderOutcomeLineage({
      route,
      publicationRef: 'instagram:post:pupson-frame1',
      clickOrSessionRef: 'pupson:session:frame1',
      orderRef: 'pupson-order:stripe-session:1',
      paymentRef: 'stripe:payment-intent:1',
      evidenceRefs: [
        'stripe:webhook:verified',
        'pupson:order-item:frame1',
      ],
    });

    expect(lineage.state).toBe('realized_revenue');
    expect(lineage.conversionRef).toBe('pupson-order:stripe-session:1');
    expect(lineage.revenueRef).toBe('stripe:payment-intent:1');
  });

  it('does not treat approved affiliate commission as realized revenue without a payout event', () => {
    const withoutPayout = affiliateEvents.filter(
      (event) => event.kind !== 'payout',
    );
    const portfolio = summarizeSideHustleAffiliatePortfolio(withoutPayout);
    const binding = bindFacelessYouTubeAffiliatePortfolio({
      id: 'binding:buyer-guides:no-payout',
      subjectId: youtubeSubject.id,
      brandId: youtubeSubject.brandId,
      ownedMediaProperty: ownedProperty,
      youtubeAccountRef: 'social-account:youtube:buyer-guides',
      affiliatePortfolio: portfolio,
      destinations: {
        'program:camera-kit': {
          destinationRef: 'affiliate-destination:camera-kit',
          disclosureRef: 'disclosure:affiliate:camera-kit',
        },
      },
      evidenceRefs: ['affiliate:portfolio:no-payout'],
    });
    const route = compileSocialCommercialRoutes({
      plan: compileSocialJuggernautPlan(youtubeSubject),
      binding,
    })[0]!;

    const lineage = createAffiliateCommercialOutcomeLineage({
      route,
      publicationRef: 'youtube:video:no-payout',
      clickOrSessionRef: 'affiliate:session:no-payout',
      affiliateEvents: withoutPayout,
      evidenceRefs: ['attribution:approved-not-realized'],
    });

    expect(lineage.state).toBe('converted');
    expect(lineage.revenueRef).toBeUndefined();
  });


});
