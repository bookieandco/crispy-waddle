import { describe, expect, it } from 'vitest';
import {
  createAdMultiplierPlan,
  createCommercialCreativeConcept,
  evaluateCommercialCreativeQc,
  validateProductIdentityBible,
  validateVisualStyleBible,
} from './commercial-creative-lab';

describe('Director commercial creative lab',()=>{
  const product={
    id:'product-bible:zesta',
    projectId:'ad-project',
    productId:'zesta',
    displayName:'Zesta Lime + Chili Chips',
    canonicalVariantId:'lime-chili',
    referenceViews:[
      {id:'hero',assetId:'zesta-hero',sha256:'sha-hero',view:'hero' as const,evidenceIds:['capture:hero']},
      {id:'front',assetId:'zesta-front',sha256:'sha-front',view:'front' as const,evidenceIds:['capture:front']},
    ],
    labelAuthorities:[{
      id:'front-label',
      assetId:'zesta-label',
      sha256:'sha-label',
      text:'FRESH ZESTY LIME · BOLD CHILI KICK · CRUNCHY POTATO CHIPS',
      surface:'front' as const,
      evidenceIds:['ocr:verified-front-label'],
    }],
    immutableTraits:['bag proportions','green-red palette','logo geometry'],
    dimensions:{width:18,height:28,depth:7,unit:'cm' as const},
    claimEvidenceIds:['claim:lime','claim:chili'],
    rightsEvidenceIds:['rights:brand-owned'],
  };
  const style={
    id:'style:zesta-cinematic',
    projectId:'ad-project',
    referenceAssetIds:['look:1','look:2'],
    referenceSha256s:['sha-look-1','sha-look-2'],
    styleBlock:'Warm practical light, restrained saturation, high contrast, grounded live-action texture.',
    lightingRules:['warm practical key','motivated fill'],
    paletteRules:['earth neutrals','controlled lime accent'],
    lensAndCameraRules:['35mm handheld for action','85mm product closeups'],
    textureRules:['natural grain','no plastic skin'],
    forbiddenDrift:['neon cyberpunk','oversaturated orange'],
    evidenceIds:['lookbook:approved'],
  };

  it('treats exact label closeups as authority rather than decorative references',()=>{
    expect(validateProductIdentityBible(product)).toEqual([]);
    expect(validateVisualStyleBible(style)).toEqual([]);
  });

  it('requires the hook to start immediately for short-form ad concepts',()=>{
    const concept=createCommercialCreativeConcept({
      id:'creative:zesta:horse',
      projectId:'ad-project',
      productBibleId:product.id,
      styleBibleId:style.id,
      platform:'instagram',
      aspectRatio:'9:16',
      targetRuntimeSeconds:15,
      hookType:'scroll-stopper',
      bigIdeaRef:'big-idea:too-good-to-ignore',
      audienceHypothesisRef:'audience:snack-seekers',
      concept:'A surreal interruption earns attention, then the product payoff explains the flavor.',
      benefitClaimRefs:['claim:lime','claim:chili'],
      beats:[
        {startSeconds:0,endSeconds:3,purpose:'hook',action:'Horse head breaks through the bathroom wall while the character eats Zesta.',productRequired:true},
        {startSeconds:3,endSeconds:8,purpose:'setup',action:'Character freezes and protects the bag.',productRequired:true},
        {startSeconds:8,endSeconds:12,purpose:'payoff',action:'Reveal flavor and texture with accurate packaging closeup.',productRequired:true},
        {startSeconds:12,endSeconds:15,purpose:'cta',action:'End card and call to action.',productRequired:true},
      ],
      evidenceIds:['concept:human-origin','growth:big-idea-evidence'],
    });
    expect(concept.authority).toBe('CREATIVE_PLAN_ONLY');
    expect(concept.beats[0]?.purpose).toBe('hook');
  });

  it('allows an ad multiplier but keeps experimental variants on one mutation axis',()=>{
    const plan=createAdMultiplierPlan({
      id:'multiplier:zesta-flavors',
      projectId:'ad-project',
      sourceCreativeId:'creative:zesta:horse',
      experimentIsolation:'single-axis',
      variants:[
        {
          id:'ad:mango',
          parentCreativeId:'creative:zesta:horse',
          mutationAxis:'product-variant',
          replacementRef:'product-bible:zesta:mango',
          replacementEvidenceIds:['catalog:mango'],
          replacementRightsEvidenceIds:['rights:brand-owned'],
          preserveProductIdentity:true,
          preserveCharacterIdentity:true,
          preserveStoryStructure:true,
        },
        {
          id:'ad:jalapeno',
          parentCreativeId:'creative:zesta:horse',
          mutationAxis:'product-variant',
          replacementRef:'product-bible:zesta:jalapeno',
          replacementEvidenceIds:['catalog:jalapeno'],
          replacementRightsEvidenceIds:['rights:brand-owned'],
          preserveProductIdentity:true,
          preserveCharacterIdentity:true,
          preserveStoryStructure:true,
        },
      ],
    });
    expect(plan.variants).toHaveLength(2);
    expect(plan.authority).toBe('PRODUCTION_PLAN_ONLY');
  });

  it('rejects visually impressive ads when product or label continuity drifts',()=>{
    const result=evaluateCommercialCreativeQc({
      creativeId:'bad-ad',
      productIdentityScore:0.71,
      labelAccuracyScore:0.52,
      styleContinuityScore:0.94,
      storyClarityScore:0.9,
      hookClarityScore:0.95,
      benefitSupportScore:0.9,
      visualArtifactScore:0.04,
      evidenceIds:['vision:product','ocr:label','story:review'],
    },{
      minimumProductIdentity:0.9,
      minimumLabelAccuracy:0.9,
      minimumStyleContinuity:0.8,
      minimumStoryClarity:0.75,
      minimumHookClarity:0.75,
      minimumBenefitSupport:0.8,
      maximumVisualArtifact:0.2,
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_AD_PRODUCT_IDENTITY_DRIFT');
    expect(result.reasons).toContain('DIRECTOR_AD_LABEL_DRIFT');
  });
});
