import {describe,expect,it,vi} from 'vitest';
import {analyzeSongSectionsFromRestoration} from './music-section-analysis-service';

vi.mock('./restoration-analysis-service',()=>({
  analyzeRestorationArtifact:vi.fn().mockResolvedValue({
    source:{
      runtimeReceiptId:'receipt-1',
      sampleRate:48000,
      sections:[
        {id:'a',startSample:0,endSample:480000,label:'section-1',confidence:0.55,evidenceIds:['e:a']},
        {id:'b',startSample:480000,endSample:960000,label:'section-2',confidence:0.6,evidenceIds:['e:b']},
      ],
    },
    separation:null,
    stemPerception:[],
  }),
}));

describe('music section analysis bridge',()=>{
  it('persists measured restoration boundaries as structural sections',async()=>{
    const repository={
      listSongs:vi.fn().mockResolvedValue([{
        id:'song-1',song_key:'catalog:test-song',title:'Test Song',release_status:'catalog',
        campaign_state:'INGESTED',artist_conviction:0.5,rights_state:'review_required',
        sections:[],evidence_refs:['catalog:test'],release_date:'2025-01-01',
      }]),
      upsertSong:vi.fn().mockResolvedValue({}),
      getProject:vi.fn(),listExperiments:vi.fn(),listObservations:vi.fn(),listCityDemand:vi.fn(),listRights:vi.fn(),listLearning:vi.fn(),
      upsertProject:vi.fn(),upsertExperiment:vi.fn(),recordObservation:vi.fn(),upsertCityDemand:vi.fn(),upsertRights:vi.fn(),upsertLearning:vi.fn(),
    };
    const receipt=await analyzeSongSectionsFromRestoration({
      client:{} as never,ownerUserId:'user-1',projectId:'project-1',songId:'song-1',caseId:'case-1',artifactId:'artifact-1',repository,
    });
    expect(receipt.sectionCount).toBe(2);
    expect(receipt.sections[0]).toMatchObject({startMs:0,endMs:10000,functions:['structure']});
    expect(repository.upsertSong).toHaveBeenCalledWith(expect.objectContaining({
      songKey:'catalog:test-song',
      sections:expect.arrayContaining([expect.objectContaining({source:'music-restoration-librosa',startMs:0,endMs:10000})]),
    }));
    expect(receipt.externalActionsStarted).toBe(false);
  });
});
