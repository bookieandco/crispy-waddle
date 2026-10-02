import {describe,expect,it,vi} from 'vitest';
import type {SocialRepository} from '../social/repository';
import type {MusicJuggernautRepository} from './music-juggernaut-repository';
import type {MusicSocialLineageRepository} from './music-social-lineage-repository';
import {syncMusicObservationsFromSocial} from './music-social-observation-sync';

function musicRepo(recordObservation=vi.fn()){
  return {
    getProject:vi.fn(async()=>({id:'project-1'})),
    listExperiments:vi.fn(async()=>[{id:'experiment-1',experiment_key:'exp-1'}]),
    recordObservation,
  } as unknown as MusicJuggernautRepository;
}

describe('music social observation sync',()=>{
  it('accepts explicit musicExperimentKey lineage',async()=>{
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
    expect(result.synced).toBe(1);
    expect(recordObservation).toHaveBeenCalledWith(expect.objectContaining({
      projectId:'project-1',
      experimentId:'experiment-1',
      observationKey:'social:obs-1',
      attributionConfidence:0.9,
      metrics:expect.objectContaining({exposures:1000,views:700,songActions:50,directFanCaptures:4}),
    }));
  });

  it('falls back to durable proposal lineage without inventing attribution',async()=>{
    const recordObservation=vi.fn(async(input)=>input);
    const social={
      listObservations:vi.fn(async()=>[{
        id:'obs-2',userId:'u1',kind:'performance' as const,source:'provider:test',
        platform:'tiktok' as const,proposalId:'proposal-1',outboxId:'outbox-1',
        observedAt:'2026-10-01T12:05:00.000Z',evidence:['provider:obs-2'],
        metrics:{views:900,music_actions:70,owned_fan_captures:6},
        attributes:{},
      }]),
    } as unknown as SocialRepository;
    const lineage={
      resolve:vi.fn(async(userId:string,proposalId:string)=>({
        userId,projectId:'project-1',proposalId,experimentKey:'exp-1',
        actionKey:'music-auto:p:social_proposal:x',evidenceRefs:['lineage:1'],
      })),
    } as unknown as MusicSocialLineageRepository;
    const result=await syncMusicObservationsFromSocial({
      userId:'u1',artistKey:'atwood-bookie',
      repository:musicRepo(recordObservation),socialRepository:social,lineageRepository:lineage,
    });
    expect(result.synced).toBe(1);
    expect(lineage.resolve).toHaveBeenCalledWith('u1','proposal-1');
    expect(recordObservation).toHaveBeenCalledTimes(1);
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
