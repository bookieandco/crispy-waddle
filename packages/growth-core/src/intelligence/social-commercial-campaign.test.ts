import { describe, expect, it } from 'vitest';
import { createSocialCommercialCampaignEnvelope } from './social-commercial-campaign.js';
import {
  bindBrandSocialCommerce,
  compileSocialCommercialRoutes,
} from './social-commercial-lineage.js';
import {
  compileSocialJuggernautPlan,
  type SocialPortfolioSubject,
} from './social-juggernaut.js';

const subject:SocialPortfolioSubject={
  id:'subject:pupson:multi-surface',
  kind:'product',
  brandId:'brand:pupsonstuff',
  label:'PupsonStuff product campaign',
  audienceSignals:['pet owner','gift buyer'],
  objectives:['discovery','product_sale'],
  preferredSurfaces:['social:instagram','social:tiktok'],
  evidenceRefs:['pupson:product-truth'],
  scores:{
    businessValue:90,
    evidenceQuality:90,
    contentReadiness:90,
    learningValue:80,
    urgency:80,
  },
};

describe('Social commercial campaign envelope',()=>{
  it('carries business binding and production lineage into the resumable campaign run',()=>{
    const plan=compileSocialJuggernautPlan(subject);
    const binding=bindBrandSocialCommerce({
      id:'binding:pupson:ig',
      subjectId:subject.id,
      brandId:subject.brandId,
      ownerRef:'pupsonstuff',
      platform:'instagram',
      socialAccountRef:'social-account:pupson:ig',
      destination:{
        label:'PupsonStuff storefront',
        destinationRef:'pupsonstuff:storefront',
        evidenceRefs:['pupson:commerce'],
      },
      evidenceRefs:['pupson:binding'],
    });
    const instagramVariants=plan.variants
      .filter(variant=>variant.platform==='instagram')
      .map(variant=>variant.id);

    const envelope=createSocialCommercialCampaignEnvelope({
      id:'commercial-campaign:pupson:ig',
      plan,
      binding,
      executableVariantIds:instagramVariants,
      evidenceRefs:['campaign:brief'],
      createdAt:'2026-10-07T20:00:00.000Z',
    });

    expect(envelope.businessBindingRef).toBe(binding.id);
    expect(envelope.run.destinationSetRefs).toEqual([binding.id]);
    expect(Object.keys(envelope.productionLineageByVariant).sort())
      .toEqual([...instagramVariants].sort());
    expect(envelope.routes.every(route=>route.platform==='instagram')).toBe(true);
    expect(envelope.publicationAuthority).toBe('NONE');
  });

  it('blocks execution of a TikTok variant when the business binding only owns Instagram',()=>{
    const plan=compileSocialJuggernautPlan(subject);
    const binding=bindBrandSocialCommerce({
      id:'binding:pupson:ig',
      subjectId:subject.id,
      brandId:subject.brandId,
      ownerRef:'pupsonstuff',
      platform:'instagram',
      socialAccountRef:'social-account:pupson:ig',
      destination:{
        label:'PupsonStuff storefront',
        destinationRef:'pupsonstuff:storefront',
        evidenceRefs:['pupson:commerce'],
      },
      evidenceRefs:['pupson:binding'],
    });

    expect(()=>createSocialCommercialCampaignEnvelope({
      id:'commercial-campaign:pupson:bad',
      plan,
      binding,
      evidenceRefs:['campaign:brief'],
    })).toThrow(/ORPHAN_VARIANTS/);
  });

  it('routes only variants with a matching account/business path',()=>{
    const plan=compileSocialJuggernautPlan(subject);
    const binding=bindBrandSocialCommerce({
      id:'binding:pupson:ig',
      subjectId:subject.id,
      brandId:subject.brandId,
      ownerRef:'pupsonstuff',
      platform:'instagram',
      socialAccountRef:'social-account:pupson:ig',
      destination:{
        label:'PupsonStuff storefront',
        destinationRef:'pupsonstuff:storefront',
        evidenceRefs:['pupson:commerce'],
      },
      evidenceRefs:['pupson:binding'],
    });
    const routes=compileSocialCommercialRoutes({plan,binding});
    expect(new Set(routes.map(route=>route.platform))).toEqual(new Set(['instagram']));
  });
});
