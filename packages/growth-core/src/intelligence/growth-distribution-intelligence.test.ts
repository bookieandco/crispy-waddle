import { describe, expect, it } from 'vitest';
import {
  assessMessageConsistency,
  createCoreAnswer,
  createSurfaceTranslation,
  summarizeThirdPartyVerification,
} from './search-everywhere.js';
import {
  assessStorytelling,
  clusterContentTopics,
  clusterHooks,
  createHumanPointOfView,
} from './content-research-system.js';
import { rankMonetizationRails } from './social-commerce-opportunity.js';

describe('search-everywhere answer system',()=>{
  const core=createCoreAnswer({
    id:'answer:1',
    brandId:'brand:pupsonstuff',
    question:'How do I turn my dog photo into a personalized gift?',
    answer:'Upload a clear pet photo, approve the generated design, then choose the product format you want.',
    claims:['clear pet photo','approve generated design','choose product format'],
    evidenceRefs:['product-flow:1'],
    createdAt:'2026-09-22T00:00:00Z',
  });

  it('keeps surface translations bound to one evidence-backed core answer',()=>{
    const google=createSurfaceTranslation(core,{
      id:'surface:google',surfaceId:'search:google',format:'article',
      title:'How to turn a dog photo into a personalized gift',
      message:'Upload a clear pet photo, approve the generated design, and choose a product format.',
      evidenceRefs:['product-flow:1'],
    });
    const tiktok=createSurfaceTranslation(core,{
      id:'surface:tiktok',surfaceId:'social:tiktok',format:'short_video',
      title:'Turn one dog photo into a gift',
      message:'Start with a clear pet photo, approve the design, then pick your product.',
      evidenceRefs:['product-flow:1'],
    });
    const result=assessMessageConsistency(core,[google,tiktok]);
    expect(result.status).toBe('aligned');
    expect(result.consistencyScore).toBe(1);
  });

  it('flags drift and missing evidence before publication',()=>{
    const drift=createSurfaceTranslation(core,{
      id:'surface:drift',surfaceId:'social:x',format:'social_post',
      title:'Guaranteed viral pet gifts',
      message:'Completely unrelated claim with no shared message.',
      evidenceRefs:[],
    });
    const result=assessMessageConsistency(core,[drift],0.15);
    expect(result.status).toBe('review_required');
    expect(result.driftedSurfaceIds).toContain('social:x');
    expect(result.missingEvidenceSurfaceIds).toContain('social:x');
  });

  it('summarizes third-party verification without treating mentions as owned claims',()=>{
    const result=summarizeThirdPartyVerification(core,[
      {id:'v1',coreAnswerId:core.id,source:'review-site',sourceLocator:'review:1',kind:'review',polarity:'positive',observedAt:'2026-09-22T00:00:00Z',evidenceRefs:['review:1']},
      {id:'v2',coreAnswerId:core.id,source:'reddit',sourceLocator:'thread:2',kind:'discussion',polarity:'mixed',observedAt:'2026-09-22T01:00:00Z',evidenceRefs:['thread:2']},
    ]);
    expect(result.mentionCount).toBe(2);
    expect(result.distinctSources).toBe(2);
    expect(result.positive).toBe(1);
    expect(result.mixed).toBe(1);
  });
});

describe('AI-assisted content research with human creative control',()=>{
  const observations=[
    {id:'v1',sourceUrl:'https://example.com/1',topic:'creative hooks',topicCategory:'creative',hook:'Stop scrolling',hookFormat:'contrarian',views:1000,transcriptEvidenceRefs:['transcript:1']},
    {id:'v2',sourceUrl:'https://example.com/2',topic:'storytelling tension',topicCategory:'storytelling',hook:'Here is what nobody tells you',hookFormat:'curiosity',views:3000,transcriptEvidenceRefs:['transcript:2']},
    {id:'v3',sourceUrl:'https://example.com/3',topic:'story arcs',topicCategory:'storytelling',hook:'The mistake I made',hookFormat:'confession',views:2000,transcriptEvidenceRefs:['transcript:3']},
  ];

  it('clusters topics and hooks from observed source data',()=>{
    const topics=clusterContentTopics(observations);
    expect(topics[0]?.topicCategory).toBe('storytelling');
    expect(topics[0]?.totalViews).toBe(5000);
    const hooks=clusterHooks(observations);
    expect(hooks).toHaveLength(3);
  });

  it('requires a human or brand POV before converting research into authored creative direction',()=>{
    const pov=createHumanPointOfView({
      topic:'storytelling tension',
      take:'For our brand, tension should come from the transformation reveal rather than manufactured controversy.',
      authorId:'brand-owner',
      sourceObservationIds:['v2'],
    });
    expect(pov.authority).toBe('HUMAN_BRAND_POV');
    expect(()=>createHumanPointOfView({topic:'x',take:'',authorId:'brand-owner',sourceObservationIds:['v1']}))
      .toThrow('HUMAN_POV_REQUIRED');
  });

  it('scores storytelling as a distinct creative quality signal',()=>{
    const result=assessStorytelling({characters:0.8,pacing:0.7,narrativeArc:0.9,worldBuilding:0.6,tension:0.8});
    expect(result.status).toBe('strong');
    expect(result.strongestPill).toBe('narrativeArc');
    expect(result.weakestPill).toBe('worldBuilding');
  });
});

describe('social commerce opportunity rails',()=>{
  it('ranks observed, evidenced rails above speculative ones',()=>{
    const ranked=rankMonetizationRails([
      {id:'s1',rail:'tiktok_shop',state:'observed',description:'Observed product sales rail',sourceRefs:['platform:1'],observedAt:'2026-09-22T00:00:00Z',monetizationModel:'affiliate',frictionScore:0.2,evidenceQuality:0.9},
      {id:'s2',rail:'visual_product_discovery',state:'hypothesis',description:'Future visual recognition commerce hypothesis',sourceRefs:['video:prediction'],observedAt:'2026-09-22T00:00:00Z',monetizationModel:'affiliate',frictionScore:0.5,evidenceQuality:0.3},
    ]);
    expect(ranked[0]?.rail).toBe('tiktok_shop');
    expect(ranked[0]?.state).toBe('observed');
    expect(ranked[1]?.authority).toBe('OPPORTUNITY_ONLY');
  });
});
