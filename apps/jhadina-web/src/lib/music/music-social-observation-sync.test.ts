import {describe,expect,it,vi} from 'vitest';
import type {SocialRepository} from '../social/repository';
import type {MusicJuggernautRepository} from './music-juggernaut-repository';
import type {MusicSocialLineageRepository} from './music-social-lineage-repository';
import {syncMusicObservationsFromSocial} from './music-social-observation-sync';

function musicRepo(recordObservation=vi.fn()){
  return {
    getProject:vi.fn(async()=>({id:'project-1'})),
    listExperiments:vi.fn(async()=>[{id:'experiment-1',experiment_key:'exp-1',song_id:'song-1',platform:'tiktok'}]),
    recordObservation,
  } as unknown as MusicJuggernautRepository;
}

describe('music social observation sync',()=>{
  it('rejects unbound explicit musicExperimentKey assertions even with impressive metrics',async()=>{
    const recordObservation=vi.fn(async(input)=>input);
    const social={
      listObservations:vi.fn(async()=>[{
        id:'obs-1',userId:'u1',kind:'performance' as const,source:'provider:test',
        platform:'instagram' as const,observedAt:'2026-10-01T12:00:00.000Z',
        evidence:['provider:obs-1'],
        metrics:{impressions:1000,views:700,song_actions:50,direct_fan_captures:4},
        attributes:{musicExperimentKey:'exp-1',musicAttributionConfidence:0.9},
      }]),
    } as unknown as SocialRepository;
    const result=await syncMusicObservationsFromSocial({
      userId:'u1',artistKey:'atwood-bookie',
      repository:musicRepo(recordObservation),socialRepository:social,
    });
    expect(result.synced).toBe(0);
    expect(result.reasons.no_music_experiment_lineage).toBe(1);
    expect(recordObservation).not.toHaveBeenCalled();
  });

  it('falls back to durable proposal lineage without inventing attribution',async()=>{
    const recordObservation=vi.fn(async(input)=>input);
    const social={
      listOutbox:vi.fn(async()=>[{id:'outbox-1',userId:'u1',proposalId:'proposal-1',
        status:'delivered',providerPostId:'provider-post-1',
        target:{platform:'tiktok',accountId:'account-1',provider:'hootsuite'}}]),
      listObservations:vi.fn(async()=>[{
        id:'obs-2',userId:'u1',kind:'performance' as const,source:'provider:test',
        platform:'tiktok' as const,proposalId:'proposal-1',outboxId:'outbox-1',contentId:'provider-post-1',
        observedAt:'2026-10-01T12:05:00.000Z',evidence:['provider:obs-2'],
        metrics:{views:900,music_actions:70,owned_fan_captures:6},
        attributes:{},
      }]),
    } as unknown as SocialRepository;
    const lineage={
      resolve:vi.fn(async(userId:string,proposalId:string)=>({
        userId,projectId:'project-1',proposalId,experimentKey:'exp-1',songId:'song-1',briefId:'brief-1',
        actionKey:'music-auto:p:social_proposal:x',evidenceRefs:['director-asset:asset-1','director-approval:receipt-1'],
      })),
    } as unknown as MusicSocialLineageRepository;
    const result=await syncMusicObservationsFromSocial({
      userId:'u1',artistKey:'atwood-bookie',
      repository:musicRepo(recordObservation),socialRepository:social,lineageRepository:lineage,
    });
    expect(result.synced).toBe(1);
    expect(lineage.resolve).toHaveBeenCalledWith('u1','proposal-1');
    expect(social.listOutbox).toHaveBeenCalledWith('u1','proposal-1');
    expect(recordObservation).toHaveBeenCalledWith(expect.objectContaining({
      evidenceRefs:expect.arrayContaining(['director-asset:asset-1','director-approval:receipt-1',
        'social-proposal:proposal-1','social-outbox:outbox-1','social-post:provider-post-1']),
    }));
  });

  it('blocks mismatched asserted keys or platforms despite a matching proposal',async()=>{
    const recordObservation=vi.fn();
    const listObservations=vi.fn(async()=>[{
      id:'bad-claim',userId:'u1',kind:'performance' as const,source:'provider:test',
      platform:'tiktok' as 'tiktok'|'instagram',proposalId:'proposal-1',outboxId:'outbox-1',contentId:'post-1',
      observedAt:'2026-10-01T12:05:00.000Z',evidence:['provider:post-1'],
      metrics:{impressions:50000},attributes:{musicExperimentKey:'another-experiment'},
    }]);
    const lineage={resolve:vi.fn(async()=>({
      userId:'u1',projectId:'project-1',proposalId:'proposal-1',experimentKey:'exp-1',
      songId:'song-1',briefId:'brief-1',actionKey:'action-1',
      evidenceRefs:['director-asset:asset-1','director-approval:receipt-1'],
    }))} as unknown as MusicSocialLineageRepository;
    const social={listObservations,listOutbox:vi.fn(async()=>[{
      id:'outbox-1',userId:'u1',proposalId:'proposal-1',status:'delivered',
      providerPostId:'post-1',target:{platform:'tiktok',accountId:'account-1',provider:'hootsuite'},
    }])} as unknown as SocialRepository;
    const first=await syncMusicObservationsFromSocial({userId:'u1',artistKey:'atwood-bookie',
      repository:musicRepo(recordObservation),socialRepository:social,lineageRepository:lineage});
    expect(first.synced).toBe(0);
    expect(first.reasons.no_music_experiment_lineage).toBe(1);
    listObservations.mockResolvedValueOnce([{
      id:'bad-platform',userId:'u1',kind:'performance' as const,source:'provider:test',
      platform:'instagram' as const,proposalId:'proposal-1',outboxId:'outbox-1',contentId:'post-1',
      observedAt:'2026-10-01T12:05:00.000Z',evidence:['provider:post-1'],
      metrics:{impressions:50000},attributes:{musicExperimentKey:'exp-1'},
    }]);
    const second=await syncMusicObservationsFromSocial({userId:'u1',artistKey:'atwood-bookie',
      repository:musicRepo(recordObservation),socialRepository:social,lineageRepository:lineage});
    expect(second.synced).toBe(0);
    expect(second.reasons.provider_post_outbox_mismatch).toBe(1);
    expect(recordObservation).not.toHaveBeenCalled();
  });

  it('refuses claimed outcomes whose post ID is not recorded on the canonical delivered outbox',async()=>{
    const recordObservation=vi.fn();
    const social={
      listObservations:vi.fn(async()=>[{
        id:'obs-forged-post',userId:'u1',kind:'performance' as const,source:'provider:test',
        platform:'tiktok' as const,proposalId:'proposal-1',outboxId:'outbox-1',contentId:'wrong-post',
        observedAt:'2026-10-01T12:05:00.000Z',evidence:['provider:obs'],
        metrics:{impressions:50000},attributes:{musicExperimentKey:'exp-1'},
      }]),
      listOutbox:vi.fn(async()=>[{id:'outbox-1',userId:'u1',proposalId:'proposal-1',
        status:'delivered',providerPostId:'real-post',
        target:{platform:'tiktok',accountId:'account-1',provider:'hootsuite'}}]),
    } as unknown as SocialRepository;
    const lineage={resolve:vi.fn(async()=>({
      userId:'u1',projectId:'project-1',proposalId:'proposal-1',experimentKey:'exp-1',
      songId:'song-1',briefId:'brief-1',actionKey:'action-1',
      evidenceRefs:['director-asset:asset-1','director-approval:receipt-1'],
    }))} as unknown as MusicSocialLineageRepository;
    const result=await syncMusicObservationsFromSocial({userId:'u1',artistKey:'atwood-bookie',
      repository:musicRepo(recordObservation),socialRepository:social,lineageRepository:lineage});
    expect(result.synced).toBe(0);
    expect(result.reasons.provider_post_outbox_mismatch).toBe(1);
    expect(recordObservation).not.toHaveBeenCalled();
  });

  it('rejects proposal lineage from another Music project',async()=>{
    const recordObservation=vi.fn();
    const social={
      listObservations:vi.fn(async()=>[{
        id:'obs-3',userId:'u1',kind:'performance' as const,source:'provider:test',
        platform:'youtube' as const,proposalId:'proposal-foreign',
        observedAt:'2026-10-01T12:10:00.000Z',evidence:['provider:obs-3'],
        metrics:{views:1000},attributes:{},
      }]),
    } as unknown as SocialRepository;
    const lineage={
      resolve:vi.fn(async()=>({
        userId:'u1',projectId:'project-other',proposalId:'proposal-foreign',
        experimentKey:'exp-1',actionKey:'x',evidenceRefs:[],
      })),
    } as unknown as MusicSocialLineageRepository;
    const result=await syncMusicObservationsFromSocial({
      userId:'u1',artistKey:'atwood-bookie',
      repository:musicRepo(recordObservation),socialRepository:social,lineageRepository:lineage,
    });
    expect(result.synced).toBe(0);
    expect(result.reasons.no_music_experiment_lineage).toBe(1);
    expect(recordObservation).not.toHaveBeenCalled();
  });

  it('does not treat generic performance observations as Music evidence',async()=>{
    const recordObservation=vi.fn();
    const social={
      listObservations:vi.fn(async()=>[{
        id:'obs-4',userId:'u1',kind:'performance' as const,source:'provider:test',
        platform:'instagram' as const,observedAt:'2026-10-01T12:15:00.000Z',
        evidence:['provider:obs-4'],metrics:{views:50000},attributes:{},
      }]),
    } as unknown as SocialRepository;
    const result=await syncMusicObservationsFromSocial({
      userId:'u1',artistKey:'atwood-bookie',
      repository:musicRepo(recordObservation),socialRepository:social,
    });
    expect(result.synced).toBe(0);
    expect(result.reasons.no_music_experiment_lineage).toBe(1);
    expect(recordObservation).not.toHaveBeenCalled();
  });
});
