import {describe,expect,it} from 'vitest';
import {
  DEFAULT_SOURCE_HEURISTIC_TOPIC_POLICY,
  assessYouTubeNiche,
  assessYouTubeTopic,
  diagnoseYouTubeVideo,
  getYouTubeProductionRecipe,
  type YouTubeNicheCandidate,
} from './youtube-channel-intelligence';

const niche:YouTubeNicheCandidate={
  id:'niche:history',channelId:'channel:1',niche:'ancient business documentaries',archetype:'documentary',
  canSustain100Videos:true,
  monetizationRails:['ads','affiliate'],
  originalityPlan:'original',
  automationFit:.9,
  comparables:[
    {id:'v1',sourceRef:'youtube:v1',channelAgeDays:60,channelSubscribers:3000,videoViews:120000,viewsPerHour:140,outlierScore:55},
    {id:'v2',sourceRef:'youtube:v2',channelAgeDays:120,channelSubscribers:8000,videoViews:200000,viewsPerHour:90,outlierScore:35},
    {id:'v3',sourceRef:'youtube:v3',channelAgeDays:900,channelSubscribers:100000,videoViews:1000000,viewsPerHour:30,outlierScore:18},
  ],
  evidenceRefs:['research:1','research:2'],
};

describe('YouTube channel intelligence',()=>{
  it('scores repeatable, original, monetizable niches using observed comparables',()=>{
    const result=assessYouTubeNiche(niche);
    expect(result.admissible).toBe(true);
    expect(result.score).toBeGreaterThan(70);
    expect(result.factors.repeatability).toBe(1);
    expect(result.factors.originalitySafety).toBe(1);
  });

  it('flags reused-heavy compilation risk instead of treating views as sufficient proof',()=>{
    const result=assessYouTubeNiche({...niche,archetype:'compilation',originalityPlan:'reused-heavy'});
    expect(result.reasons).toContain('YOUTUBE_NICHE_REUSED_CONTENT_RISK_HIGH');
    expect(result.factors.originalitySafety).toBe(.2);
  });

  it('keeps creator outlier/VPH thresholds explicitly source-heuristic rather than platform truth',()=>{
    const topic=assessYouTubeTopic({
      id:'topic:1',channelId:'channel:1',title:'Ancient trade empires',premise:'How merchants built fortunes',
      monetizationFitScore:.8,originalityRisk:.1,
      evidence:[
        {id:'a',sourceRef:'source:a',videoAgeDays:30,viewsPerHour:120,outlierScore:60},
        {id:'b',sourceRef:'source:b',videoAgeDays:800,viewsPerHour:25,outlierScore:25},
      ],
      evidenceRefs:['source:a','source:b'],
    });
    expect(DEFAULT_SOURCE_HEURISTIC_TOPIC_POLICY.authority).toBe('SOURCE_HEURISTIC');
    expect(topic.sourceHeuristicMatches).toEqual(expect.arrayContaining([
      'outlier>=20:a','outlier>=50:a','recent-vph>=100:a','evergreen-vph>=20:b',
    ]));
    expect(topic.reasons).toContain('YOUTUBE_TOPIC_HEURISTICS_ARE_NOT_PLATFORM_GUARANTEES');
  });

  it('diagnoses packaging and retention against channel-owned baselines',()=>{
    const result=diagnoseYouTubeVideo({
      id:'obs:1',channelId:'channel:1',videoId:'video:1',observedAt:'2026-09-25T00:00:00Z',
      impressions:10000,views:500,clickThroughRate:.03,averageViewDurationSeconds:120,videoDurationSeconds:600,
      subscribersGained:2,evidenceRefs:['analytics:snapshot'],
    },{
      minimumObservations:10,medianClickThroughRate:.05,medianAveragePercentViewed:.4,medianSubscribersPerThousandViews:8,
    });
    expect(result.packaging).toBe('below-baseline');
    expect(result.retention).toBe('below-baseline');
    expect(result.subscriberConversion).toBe('below-baseline');
  });

  it('creates a dedicated AI music recipe with loop and crossfade semantics',()=>{
    const recipe=getYouTubeProductionRecipe('ai-music');
    expect(recipe.visualStrategy.join(' ')).toContain('first-frame=last-frame');
    expect(recipe.audioStrategy.join(' ')).toContain('crossfades');
    expect(recipe.requiresRightsReview).toBe(true);
  });

  it('treats compilation as high reused-content risk',()=>{
    expect(getYouTubeProductionRecipe('compilation').reusedContentRisk).toBe('high');
  });
});
