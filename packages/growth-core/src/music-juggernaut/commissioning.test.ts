import {describe,expect,it} from 'vitest';
import {
  ATWOOD_BOOKIE_ARTIST_NAME,
  ATWOOD_BOOKIE_CANONICAL_HUB,
  assessRightsMoneyCommission,
  buildSocialBaseline,
  buildSongIntelligenceQueue,
  canonicalAtwoodBookieIdentity,
  catalogSongSeeds,
  certifyAttackCanary,
  certifyMusicCommissionClosedLoop,
  planSearchExperiments,
  publicAtwoodBookieCatalogSeed,
  resolveArtistHubLinks,
} from './commissioning.js';

describe('MUSIC-COMMISSION.1 -> MUSIC-COMMISSION.FINAL',()=>{
  it('binds the canonical artist identity without conflating the owner identity',()=>{
    const identity=canonicalAtwoodBookieIdentity();
    expect(identity.canonicalName).toBe(ATWOOD_BOOKIE_ARTIST_NAME);
    expect(identity.ownerIdentity).toBe('Bookie & Co');
    expect(identity.canonicalHub).toBe(ATWOOD_BOOKIE_CANONICAL_HUB);
  });

  it('resolves supported links and rejects unsafe schemes',()=>{
    const links=resolveArtistHubLinks([
      'https://open.spotify.com/artist/abc',
      'https://www.instagram.com/atwoodbookie/',
      'javascript:alert(1)',
    ]);
    expect(links.map((item)=>item.platform)).toEqual(['spotify','instagram']);
  });

  it('ships a real public catalog seed without pretending it is complete',()=>{
    const releases=publicAtwoodBookieCatalogSeed();
    const songs=catalogSongSeeds(releases);
    expect(releases.length).toBeGreaterThanOrEqual(15);
    expect(songs.length).toBeGreaterThanOrEqual(30);
    expect(releases.every((item)=>item.evidenceRefs.length>0)).toBe(true);
  });

  it('queues audio analysis rather than inventing section timestamps',()=>{
    const queue=buildSongIntelligenceQueue([{songKey:'a',title:'A',sections:[],evidenceRefs:['catalog:a']}]);
    expect(queue[0]?.state).toBe('ANALYSIS_REQUIRED');
    expect(queue[0]?.sectionCount).toBe(0);
  });

  it('filters low-quality social evidence out of the baseline',()=>{
    const observations=[
      obs('a',900,70,10,0.05,0.9),
      obs('b',1000,75,11,0.05,0.9),
      obs('c',800,60,9,0.05,0.9),
      obs('bot',50000,0,0,0.99,0.05),
    ];
    const baseline=buildSocialBaseline(observations);
    expect(baseline.state).toBe('READY');
    expect(baseline.eligibleSamples).toBe(3);
    expect(baseline.excludedSamples).toBe(1);
  });

  it('creates zero-spend search plans only',()=>{
    const plans=planSearchExperiments({songs:catalogSongSeeds().slice(0,3)});
    expect(plans).toHaveLength(3);
    expect(plans.every((item)=>item.spendMinor===0)).toBe(true);
    expect(plans.every((item)=>item.authority==='INTERNAL_PLANNING_ONLY')).toBe(true);
  });

  it('blocks attack when rights or approved budget are missing',()=>{
    const gate=assessRightsMoneyCommission({
      rights:[{
        assetId:'song',masterOwnershipKnown:false,publishingKnown:false,
        sampleStatus:'review_required',thirdPartyUsageStatus:'review_required',evidenceRefs:['rights:unknown'],
      }],
    });
    expect(gate.attackEligible).toBe(false);
    expect(gate.blockers).toContain('RIGHTS_NOT_FULLY_MAPPED');
    expect(gate.blockers).toContain('NO_APPROVED_PROMOTION_BUDGET');
  });

  it('passes the zero-external-action attack canary',()=>{
    const canary=certifyAttackCanary();
    expect(canary.passed).toBe(true);
    expect(canary.realSignalMode).toBe('ATTACK');
    expect(canary.fakeSignalMode).toBe('SEARCH');
    expect(canary.rightsBlockedSpendMinor).toBe(0);
    expect(canary.externalActionsStarted).toBe(false);
  });

  it('passes closed-loop certification across every commission stage',()=>{
    const report=certifyMusicCommissionClosedLoop();
    expect(report.passed).toBe(true);
    expect(report.externalActionsStarted).toBe(false);
    expect(report.checks).toHaveLength(10);
    expect(report.checks.every((item)=>item.passed)).toBe(true);
  });
});

function obs(id:string,views:number,songActions:number,directFanCaptures:number,botRisk:number,attributionConfidence:number){
  return {
    id,experimentId:id,exposures:3000,views,shares:20,saves:30,comments:10,profileVisits:40,
    songActions,directFanCaptures,botRisk,attributionConfidence,
    observedAt:'2026-09-30T12:00:00.000Z',evidenceRefs:['social:'+id],
  };
}
