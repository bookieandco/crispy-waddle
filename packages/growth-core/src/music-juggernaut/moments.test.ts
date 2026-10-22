import {describe,expect,it} from 'vitest';
import {buildMomentsPilot,type MomentsPilotInput} from './moments.js';
import type {SongRecord,RightsRecord} from './domain.js';

const song:SongRecord={
  id:'song:moments',title:'Moments',status:'released',artistConviction:0.8,
  rightsState:'clear',releaseDate:'2022-04-16',evidenceRefs:['catalog:release:boo-hefner-spring-2022'],
  sections:[{id:'measured-hook',songId:'song:moments',startMs:18000,endMs:39500,
    label:'measured section',functions:['melody','performance']}],
};
const rights:RightsRecord={
  assetId:'song:moments',masterOwnershipKnown:true,publishingKnown:true,
  sampleStatus:'none',thirdPartyUsageStatus:'none',
  evidenceRefs:['owner-rights-review:external-receipt'],
};
const sectionProof={
  songId:song.id,sectionId:'measured-hook',audioSha256:'a'.repeat(64),
  analysisReceiptRef:'restoration:case:measured',measuredFromOwnedAudio:true as const,
};
const base:MomentsPilotInput={songs:[song],rights,sectionProofs:[sectionProof]};
const director=(briefId:string)=>({
  songId:song.id,sectionId:'measured-hook',briefId,
  jobId:'director-job:14',assetSha256:'b'.repeat(64),
  previewRef:'director-preview:14',ownerApprovalRef:'director-approval:14',
  approvedAt:'2026-10-21T18:00:00Z',
});

describe('Music Juggernaut Moments pilot .01-.05',()=>{
  it('resolves only the canonical catalog release and owner song, never assumes source licenses',()=>{
    const empty=buildMomentsPilot({songs:[]});
    expect(empty.catalog.title).toBe('Moments');
    expect(empty.catalog.release).toBe('Boo Hefner Spring 2022');
    expect(empty.songId).toBeNull();
    expect(empty.livePilotVerified).toBe(false);
    const noRights=buildMomentsPilot({songs:[{...song,rightsState:'review_required'}]});
    expect(noRights.stages[0]?.state).toBe('verified');
    expect(noRights.stages[1]?.state).toBe('blocked');
    expect(noRights.sectionRangeMs).toBeNull();
    expect(noRights.growthAdsDraft).toBeNull();
    expect(noRights.externalActionsStarted).toBe(false);
  });
  it('never invents a timecode, accepts duplicate song or forged analyzer proof',()=>{
    const duplicate=buildMomentsPilot({songs:[song,{...song,id:'duplicate'}],rights,sectionProofs:[sectionProof]});
    expect(duplicate.songId).toBeNull();
    const missing=buildMomentsPilot({songs:[song],rights,sectionProofs:[]});
    expect(missing.sectionRangeMs).toBeNull();
    const badHash=buildMomentsPilot({...base,sectionProofs:[{...sectionProof,audioSha256:'unverified'}]});
    expect(badHash.sectionRangeMs).toBeNull();
  });
  it('prepares diverse section-specific Director briefs, never a rendered-asset claim',()=>{
    const result=buildMomentsPilot(base);
    expect(result.sectionRangeMs).toEqual({start:18000,end:39500});
    expect(result.directorBriefs).toHaveLength(3);
    expect(new Set(result.directorBriefs.map(brief=>brief.family)).size).toBe(3);
    expect(result.directorBriefs.every(brief=>brief.sectionId==='measured-hook')).toBe(true);
    expect(result.stages[2]?.state).toBe('blocked');
    expect(result.socialDraft).toBeNull();
    expect(result.growthAdsDraft).toEqual(expect.objectContaining({
      spendMinor:0,requiresGrowthApproval:true,authority:'PROPOSAL_ONLY',
    }));
  });
  it('rejects wrong song, unapproved Director and unverified Social delivery',()=>{
    const staged=buildMomentsPilot(base);
    const approved=director(staged.directorBriefs[0]!.id);
    expect(buildMomentsPilot({...base,directorProof:{...approved,ownerApprovalRef:''}}).socialDraft).toBeNull();
    const ready=buildMomentsPilot({...base,directorProof:approved});
    expect(ready.stages[2]?.state).toBe('verified');
    expect(ready.stages[3]?.state).toBe('unverified');
    expect(ready.socialDraft?.requiresIndependentChildApproval).toBe(true);
    expect(ready.externalActionsStarted).toBe(false);
  });
  it('admits only two distinct provider-matched posts with quality signal',()=>{
    const first=buildMomentsPilot(base);
    const asset=director(first.directorBriefs[0]!.id);
    const experimentKey='moments:'+song.id+':measured-hook:search';
    const makePost=(postId:string)=>({
      songId:song.id,sectionId:'measured-hook',briefId:asset.briefId,
      directorAssetSha256:asset.assetSha256,experimentKey,platform:'instagram',
      accountId:'owner-account',proposalId:'proposal:'+postId,childApprovalRef:'child-approval:'+postId,
      outboxId:'outbox:'+postId,providerPostId:postId,providerReadbackRef:'provider-readback:'+postId,
    });
    const posts=[makePost('p1'),makePost('p2')];
    const makeOutcome=(postId:string)=>({experimentKey,platform:'instagram',accountId:'owner-account',
      providerPostId:postId,exposures:300,songActions:12,attributionConfidence:0.9,
      botRisk:0.03,observationRef:'observed:'+postId});
    const good=buildMomentsPilot({...base,directorProof:asset,socialReadbacks:posts,
      measuredOutcomes:[makeOutcome('p1'),makeOutcome('p2')]});
    expect(good.stages.every(s=>s.state==='verified')).toBe(true);
    expect(good.validatedLearning).toEqual(expect.objectContaining({
      songId:song.id,experimentId:experimentKey,family:'mini_music_video',
    }));
    expect(good.pilotEvidenceMatched).toBe(true);
    expect(good.livePilotVerified).toBe(false);
    expect(good.externalActionsStarted).toBe(false);
    const forged=buildMomentsPilot({...base,directorProof:asset,
      socialReadbacks:[posts[0]!,{...posts[1]!,accountId:'different-account'}],
      measuredOutcomes:[makeOutcome('p1'),makeOutcome('p2')]});
    expect(forged.validatedLearning).toBeNull();
    const bot=buildMomentsPilot({...base,directorProof:asset,socialReadbacks:posts,
      measuredOutcomes:[makeOutcome('p1'),{...makeOutcome('p2'),botRisk:0.95}]});
    expect(bot.validatedLearning).toBeNull();
    const ghost=buildMomentsPilot({...base,directorProof:asset,socialReadbacks:posts,
      measuredOutcomes:[makeOutcome('p1'),{...makeOutcome('p2'),providerPostId:'ghost'}]});
    expect(ghost.validatedLearning).toBeNull();
  });
});
