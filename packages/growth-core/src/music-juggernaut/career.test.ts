import {describe,expect,it} from 'vitest';
import {
  advanceFanStage,
  assessBreakoutReadiness,
  assessCreativeDiversity,
  assessManagementReadiness,
  assessOfferStack,
  buildSongSectionHeatmap,
  diagnoseMusicBottleneck,
  forecastCashFlow,
  makeMusicMakeSenseAudit,
  scoreTrendOpportunity,
} from './index.js';

describe('Music Juggernaut career intelligence',()=>{
  it('rejects file-count masquerading as creative diversity',()=>{
    const result=assessCreativeDiversity({variants:[
      {id:'1',family:'performance',hook:'a',environment:'room'},
      {id:'2',family:'performance',hook:'a',environment:'room'},
      {id:'3',family:'performance',hook:'b',environment:'room'},
    ]});
    expect(result.sufficientForExploration).toBe(false);
  });

  it('builds a section heatmap from downstream behavior',()=>{
    const heat=buildSongSectionHeatmap({
      song:{id:'song',title:'Song',status:'released',artistConviction:0.8,rightsState:'clear',evidenceRefs:['song:1'],sections:[
        {id:'a',songId:'song',startMs:0,endMs:10000,label:'verse',functions:['lyric']},
        {id:'b',songId:'song',startMs:10000,endMs:20000,label:'hook',functions:['melody','loop']},
      ]},
      experiments:[{id:'ea',sectionId:'a'},{id:'eb',sectionId:'b'}],
      observations:[
        {id:'oa',experimentId:'ea',exposures:1000,views:700,shares:10,saves:10,comments:5,profileVisits:15,songActions:20,directFanCaptures:2,botRisk:0,attributionConfidence:1,observedAt:'2026-09-30T00:00:00Z',evidenceRefs:['oa']},
        {id:'ob',experimentId:'eb',exposures:1000,views:700,shares:30,saves:60,comments:20,profileVisits:50,songActions:120,directFanCaptures:20,botRisk:0,attributionConfidence:1,observedAt:'2026-09-30T00:00:00Z',evidenceRefs:['ob']},
      ],
    });
    expect(heat[0]?.sectionId).toBe('b');
  });

  it('scores trend fit without treating velocity as sufficient',()=>{
    expect(scoreTrendOpportunity({trendId:'t',velocity:1,saturation:0.9,artistFit:0.1,songFit:0.1,audienceFit:0.1,productionSpeed:1,brandFit:0.1}).recommendation).toBe('PASS');
    expect(scoreTrendOpportunity({trendId:'t2',velocity:0.9,saturation:0.2,artistFit:0.9,songFit:0.95,audienceFit:0.9,productionSpeed:0.9,brandFit:0.95}).recommendation).toBe('ATTACK');
  });

  it('keeps breakout readiness separate from breakout attention',()=>{
    const result=assessBreakoutReadiness({followupSongReady:false,contentInventory:2,directFanCaptureReady:false,rightsMapped:false,teamCapacity:false,liveProfileReady:false,catalogDepth:1,evidenceRefs:['readiness:1']});
    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBe(7);
  });

  it('treats management as leverage rather than rescue',()=>{
    expect(assessManagementReadiness({inboundOpportunityCount:0,weeklyCoordinationHours:2,unresolvedRightsOrDealItems:0,activePartnerThreads:0,artistConsistency:0.2,evidenceRefs:['m:1']}).state).toBe('TOO_EARLY');
    expect(assessManagementReadiness({inboundOpportunityCount:10,weeklyCoordinationHours:20,unresolvedRightsOrDealItems:4,activePartnerThreads:10,artistConsistency:0.9,evidenceRefs:['m:2']}).state).toBe('REAL_BOTTLENECK');
  });

  it('requires sequential fan relationship progression',()=>{
    expect(advanceFanStage('VIEWER','FOLLOWER')).toBe('FOLLOWER');
    expect(()=>advanceFanStage('VIEWER','BUYER')).toThrow('MUSIC_JUGGERNAUT_FAN_STAGE_INVALID');
  });

  it('blocks continuity offers with no recurring value',()=>{
    const result=assessOfferStack([
      {id:'free',kind:'ATTRACTION',description:'private demo',targetStage:'FOLLOWER',recurring:false,recurringValueDefined:false},
      {id:'ticket',kind:'CORE',description:'show ticket',targetStage:'DIRECT_FAN',recurring:false,recurringValueDefined:false},
      {id:'club',kind:'CONTINUITY',description:'membership',targetStage:'COMMUNITY',recurring:true,recurringValueDefined:false},
    ]);
    expect(result.valid).toBe(false);
  });

  it('detects cash shortfalls even when ending positive',()=>{
    const result=forecastCashFlow(1000,[
      {id:'deposit',direction:'out',amountMinor:2000,occursAt:'2026-10-01T00:00:00Z',description:'venue'},
      {id:'settle',direction:'in',amountMinor:5000,occursAt:'2026-10-03T00:00:00Z',description:'ticket settlement'},
    ]);
    expect(result.shortfall).toBe(true);
    expect(result.endingBalanceMinor).toBe(4000);
  });

  it('diagnoses the largest funnel gap',()=>{
    const result=diagnoseMusicBottleneck([
      {stage:'attention',actualRate:0.7,targetRate:0.7,evidenceRefs:['a']},
      {stage:'music_transfer',actualRate:0.05,targetRate:0.2,evidenceRefs:['b']},
      {stage:'direct_fan',actualRate:0.08,targetRate:0.1,evidenceRefs:['c']},
    ]);
    expect(result.bottleneck).toBe('music_transfer');
  });

  it('fails make-it-make-sense when a spend claim is unreplicated',()=>{
    const result=makeMusicMakeSenseAudit({claim:'scale this creative',evidenceRefs:['x'],sampleSize:20,attributionConfidence:0.9,hasReplication:false,hasContradictoryEvidence:false,spendDecision:true});
    expect(result.passes).toBe(false);
  });
});
