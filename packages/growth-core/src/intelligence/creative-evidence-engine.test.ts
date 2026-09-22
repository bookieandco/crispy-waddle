import { describe, expect, it } from 'vitest';
import {
  assertCommercialContext,
  buildCreativeEcosystem,
  prioritizeCreativeTests,
  rankBigIdeas,
  recommendValidationFormat,
} from './creative-evidence-engine.js';
import {
  createRedditTargetingPlan,
  diagnoseMetaCreative,
  diagnoseRedditCreative,
  diagnoseTikTokCreative,
} from './paid-social-playbooks.js';
import {
  createStoreDisplayFormula,
  evaluateFormulaBatch,
  evaluateGeneratedCreative,
} from './creative-formula-factory.js';

describe('evidence-ranked paid social creative intelligence',()=>{
  it('ranks first-party performance above external inspiration and never validates competitor-only patterns',()=>{
    const ranked=rankBigIdeas([
      {id:'own-1',evidenceClass:'first_party_performance',bigIdea:'5 minute routine',sourceRefs:['meta:ad-1'],observedAt:'2026-09-22T00:00:00Z',spend:1000,conversions:30,contributionMargin:1200},
      {id:'competitor-1',evidenceClass:'competitor_pattern',bigIdea:'competitor meme',sourceRefs:['library:ad-9'],observedAt:'2026-09-22T00:00:00Z',recurrence:30},
      {id:'competitor-2',evidenceClass:'competitor_pattern',bigIdea:'competitor meme',sourceRefs:['library:ad-10'],observedAt:'2026-09-22T00:00:00Z',recurrence:30},
    ]);
    expect(ranked[0]?.bigIdea).toBe('5 minute routine');
    expect(ranked[0]?.status).toBe('validated');
    const competitor=ranked.find(item=>item.bigIdea==='competitor meme');
    expect(competitor?.status).toBe('hypothesis');
    expect(competitor?.firstPartySupport).toBe(false);
  });

  it('validates cheap formats first and can later translate a proven idea across an ecosystem',()=>{
    const [idea]=rankBigIdeas([
      {id:'organic-1',evidenceClass:'organic_pattern',bigIdea:'fast morning routine',sourceRefs:['reel:1'],observedAt:'2026-09-22T00:00:00Z',recurrence:5},
    ]);
    expect(recommendValidationFormat(idea!)).toBe('image');
    const ecosystem=buildCreativeEcosystem({idea:idea!,formats:['image','ugc'],commercialContexts:['busy professionals'],hookVariants:2});
    expect(ecosystem.some(item=>item.relationship==='format_translation')).toBe(true);
    expect(ecosystem.some(item=>item.commercialContext==='busy professionals')).toBe(true);
    expect(ecosystem.filter(item=>item.relationship==='hook_variation')).toHaveLength(2);
  });

  it('rejects sensitive persona/context translations',()=>{
    expect(()=>assertCommercialContext('people with fertility challenges')).toThrow('SENSITIVE_CREATIVE_CONTEXT_FORBIDDEN');
    const [idea]=rankBigIdeas([{id:'x',evidenceClass:'expert_heuristic',bigIdea:'x',sourceRefs:['video'],observedAt:'2026-09-22T00:00:00Z'}]);
    expect(()=>buildCreativeEcosystem({idea:idea!,formats:['image'],commercialContexts:['political party members']}))
      .toThrow('SENSITIVE_CREATIVE_CONTEXT_FORBIDDEN');
  });

  it('prioritizes evidence and learning speed while penalizing expensive production',()=>{
    const ranked=prioritizeCreativeTests([
      {id:'static',bigIdea:'x',format:'image',evidenceScore:0.7,expectedLearningSpeed:1,scalePotential:0.7},
      {id:'video',bigIdea:'x',format:'short_video',evidenceScore:0.7,expectedLearningSpeed:0.3,scalePotential:0.8},
    ]);
    expect(ranked[0]?.id).toBe('static');
  });

  it('keeps Meta diagnostics evidence-window aware',()=>{
    const result=diagnoseMetaCreative(
      {impressions:5000,clicks:100,conversions:5,spend:200,contributionMargin:300,windowDays:7,landingViews:80,negativeFeedbackRate:0.002},
      {id:'meta-profile',sourceRefs:['account-history'],minConversions:3,minWindowDays:3},
    );
    expect(result.evidenceState).toBe('decision_ready');
    expect(result.ctr).toBeCloseTo(0.02);
    expect(result.userExperienceSignal).toBe('healthy');
  });

  it('treats TikTok thresholds as supplied profiles, not universal constants',()=>{
    const result=diagnoseTikTokCreative(
      {impressions:3000,clicks:90,conversions:4,spend:80,contributionMargin:120,windowDays:3,twoSecondViews:2100,videoStarts:3000,watchedToQuarter:1400,averageWatchSeconds:7,videoDurationSeconds:20},
      {id:'tt-own-history',sourceRefs:['tiktok:account-history'],targetCpa:25,minimumSpendMultipleOfTargetCpa:1.5,minCtr:0.015,minHookRate:0.5,minHoldRate:0.25,minWindowDays:1,minConversions:2},
    );
    expect(result.evidenceState).toBe('decision_ready');
    expect(result.action).toBe('eligible_to_scale');
  });

  it('models Reddit community targeting independently and blocks sensitive communities',()=>{
    const plan=createRedditTargetingPlan({
      communities:[{community:'r/astronomy',rationale:'people actively discuss telescopes and observing',sourceRefs:['reddit:community-observation']}],
      keywords:['telescope accessories'],
      conversionEvent:'purchase',
    });
    expect(plan.mode).toBe('community_plus_keyword');
    expect(plan.nativeCreativeRequired).toBe(true);
    expect(()=>createRedditTargetingPlan({
      communities:[{community:'r/fertility',rationale:'fertility challenges',sourceRefs:['reddit:example']}],
    })).toThrow('SENSITIVE_CREATIVE_CONTEXT_FORBIDDEN');
  });

  it('evaluates Reddit decisions from configured evidence thresholds',()=>{
    const result=diagnoseRedditCreative(
      {impressions:1500,clicks:45,conversions:3,spend:60,contributionMargin:90,windowDays:5},
      {id:'reddit-own-history',sourceRefs:['reddit:account-history'],targetCpa:25,minCtr:0.015,minWindowDays:3,minConversions:2},
    );
    expect(result.evidenceState).toBe('decision_ready');
    expect(result.recommendation).toBe('eligible_to_scale');
  });
});

describe('repeatable AI creative formula factory',()=>{
  it('creates a non-publishing product-to-video formula with explicit QC',()=>{
    const formula=createStoreDisplayFormula({
      imageModel:'image-model',
      videoModel:'video-model',
      aspectRatio:'9:16',
      imageResolution:'1k',
      videoResolution:'480p',
      durationSeconds:6,
      reversePlayback:true,
      muteGeneratedAudio:true,
      minimumQcScore:0.8,
    });
    expect(formula.authority).toBe('PRODUCTION_PLAN_ONLY');
    expect(formula.nodes.find(node=>node.kind==='output')?.config.autoPublish).toBe(false);
    expect(formula.nodes.find(node=>node.kind==='quality_control')).toBeDefined();
  });

  it('rejects distorted or invented generations',()=>{
    const result=evaluateGeneratedCreative({
      candidateId:'candidate-1',productId:'product-1',productIdentityScore:0.95,textLegibilityScore:0.9,
      geometryScore:0.4,brandIntegrityScore:0.9,noUnrequestedPeople:true,noInventedClaims:true,outputRef:'asset:1',
    },0.8);
    expect(result.passed).toBe(false);
    expect(result.reasonCodes).toContain('GEOMETRY_WEAK');
  });

  it('requires a high batch pass rate before treating a formula as production-ready',()=>{
    const good=(id:string)=>({
      candidateId:id,productId:'p',productIdentityScore:0.95,textLegibilityScore:0.95,
      geometryScore:0.95,brandIntegrityScore:0.95,noUnrequestedPeople:true,noInventedClaims:true,outputRef:`asset:${id}`,
    });
    const result=evaluateFormulaBatch([
      good('1'),good('2'),good('3'),good('4'),
      {...good('5'),productIdentityScore:0.2},
    ],{minimumQcScore:0.8,minimumPassRate:0.8});
    expect(result.passRate).toBe(0.8);
    expect(result.status).toBe('accepted');
  });
});
