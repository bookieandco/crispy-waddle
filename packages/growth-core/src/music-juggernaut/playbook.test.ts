import {describe,expect,it} from 'vitest';
import {
  assessGuerrillaMusicOpportunity,
  assessLivePerformanceProgress,
  assessMusicCollaborator,
  assessMusicSearchPresence,
  classifyReleaseRole,
} from './playbook.js';

describe('Music Juggernaut full attack playbook',()=>{
  it('blocks deceptive or unpermissioned guerrilla tactics',()=>{
    const result=assessGuerrillaMusicOpportunity({
      id:'g1',concept:'surprise location performance',talkValue:0.9,artistFit:0.9,localFit:0.8,productionEase:0.8,
      permissionConfirmed:false,rightsClear:true,deceptive:false,spamRisk:0.1,evidenceRefs:['g:1'],
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers[0]).toContain('permission');
  });

  it('values trust and creative fit over raw collaborator reach',()=>{
    const strong=assessMusicCollaborator({id:'small',audienceOverlap:0.5,audienceComplement:0.9,trustTransfer:0.9,creativeFit:0.95,geographicFit:0.8,relationshipPotential:0.9,rawReach:0.2,evidenceRefs:['c:1']});
    const weak=assessMusicCollaborator({id:'big',audienceOverlap:0.2,audienceComplement:0.2,trustTransfer:0.2,creativeFit:0.2,geographicFit:0.2,relationshipPotential:0.1,rawReach:1,evidenceRefs:['c:2']});
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('assigns different jobs to releases from observed behavior',()=>{
    expect(classifyReleaseRole({coldReachRate:0.9,profileTransferRate:0.8,secondSongRate:0.1,repeatListenerRate:0.1,directFanRate:0.05,existingFanEngagement:0.1}).role).toBe('ACQUISITION');
    expect(classifyReleaseRole({coldReachRate:0.2,profileTransferRate:0.2,secondSongRate:0.8,repeatListenerRate:0.7,directFanRate:0.5,existingFanEngagement:0.4}).role).toBe('CONVERSION');
  });

  it('treats live performance as a trainable craft',()=>{
    const progress=assessLivePerformanceProgress({
      id:'show-2',confidence:0.7,vocalControl:0.8,audienceEyeContact:0.4,crowdInteraction:0.5,movement:0.6,setPacing:0.7,recovery:0.8,
      observedAt:'2026-09-30T00:00:00Z',evidenceRefs:['show:2'],
    },{
      id:'show-1',confidence:0.5,vocalControl:0.7,audienceEyeContact:0.3,crowdInteraction:0.4,movement:0.5,setPacing:0.6,recovery:0.7,
      observedAt:'2026-09-20T00:00:00Z',evidenceRefs:['show:1'],
    });
    expect(progress.delta).toBeGreaterThan(0);
    expect(progress.weakest).toBe('audienceEyeContact');
  });

  it('requires a machine-readable search footprint instead of pure social dependence',()=>{
    const result=assessMusicSearchPresence({
      canonicalArtistPage:true,canonicalSongPage:true,lyrics:true,credits:true,structuredMetadata:true,transcripts:false,
      storyContext:true,consistentEntityNaming:true,currentLinks:true,evidenceRefs:['search:1'],
    });
    expect(result.ready).toBe(true);
    expect(result.missing).toContain('transcripts');
  });
});
