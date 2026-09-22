import { describe, expect, it } from 'vitest';
import { compilePlatformCreativeBrief, createPlatformCreativeProfile } from './platform-ad-creative.js';

describe('platform ad creative profile',()=>{
  const profile=createPlatformCreativeProfile({
    id:'profile:instagram-reels:2026-09',
    platform:'instagram',
    placement:'reels',
    allowedAspectRatios:['9:16'],
    defaultAspectRatio:'9:16',
    minimumRuntimeSeconds:5,
    maximumRuntimeSeconds:90,
    openingHookDeadlineSeconds:5,
    captionSafeAreaRef:'safe-area:instagram-reels:2026-09',
    nativeCreativeNotes:['Front-load the concept and keep platform UI safe areas clear.'],
    sourceRefs:['source:platform-spec:2026-09'],
    observedAt:'2026-09-22T18:00:00.000Z',
    validUntil:'2026-12-31T23:59:59.000Z',
  });

  it('compiles a platform-specific creative brief from evidence-backed profile rules',()=>{
    const brief=compilePlatformCreativeBrief({
      id:'brief:zesta:reels',
      profile,
      productIdentityRef:'product:zesta:lime',
      styleIdentityRef:'style:zesta:cinematic',
      bigIdeaRef:'idea:focus',
      audienceHypothesisRef:'audience:snackers',
      hook:'A horse crashes through the wall while the product is already visible.',
      message:'The snack is too good to ignore.',
      visualDirection:'Grounded live action with one surreal interruption.',
      callToAction:'Shop now',
      targetRuntimeSeconds:15,
      productTruthRefs:['truth:zesta:lime','truth:zesta:chili'],
      claimEvidenceRefs:['claim:zesta:flavor'],
      evidenceRefs:['concept:human-origin','competitor-pattern:hook'],
      asOf:'2026-09-22T19:00:00.000Z',
    });

    expect(brief.aspectRatio).toBe('9:16');
    expect(brief.profileId).toBe(profile.id);
    expect(brief.authority).toBe('PRODUCTION_PLAN_ONLY');
  });

  it('refuses unsupported aspect ratios instead of forcing one platform template everywhere',()=>{
    expect(()=>compilePlatformCreativeBrief({
      id:'brief:bad',
      profile,
      productIdentityRef:'product:zesta',
      styleIdentityRef:'style:zesta',
      bigIdeaRef:'idea:1',
      audienceHypothesisRef:'audience:1',
      hook:'Hook',
      message:'Message',
      visualDirection:'Direction',
      aspectRatio:'16:9',
      targetRuntimeSeconds:15,
      productTruthRefs:['truth:1'],
      evidenceRefs:['evidence:1'],
    })).toThrow(/GROWTH_PLATFORM_CREATIVE_ASPECT_NOT_ALLOWED/);
  });

  it('fails closed when a time-bounded platform profile is stale',()=>{
    expect(()=>compilePlatformCreativeBrief({
      id:'brief:stale',
      profile,
      productIdentityRef:'product:zesta',
      styleIdentityRef:'style:zesta',
      bigIdeaRef:'idea:1',
      audienceHypothesisRef:'audience:1',
      hook:'Hook',
      message:'Message',
      visualDirection:'Direction',
      targetRuntimeSeconds:15,
      productTruthRefs:['truth:1'],
      evidenceRefs:['evidence:1'],
      asOf:'2027-01-01T00:00:00.000Z',
    })).toThrow(/GROWTH_PLATFORM_CREATIVE_PROFILE_STALE/);
  });
});
