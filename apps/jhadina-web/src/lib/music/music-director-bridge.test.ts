import {describe,expect,it,vi} from 'vitest';
import {createMusicDirectorPackage} from './music-director-bridge';

function musicRepo(){
  return {
    getProject:vi.fn().mockResolvedValue({id:'project-1',artist_key:'atwood-bookie'}),
    listSongs:vi.fn().mockResolvedValue([{
      id:'song-1',song_key:'playa-2',title:'Playa 2',
      sections:[{id:'hook',startMs:0,endMs:12000,label:'Hook',functions:['lyric','loop']}],
      evidence_refs:['song:playa-2'],
    }]),
    listExperiments:vi.fn().mockResolvedValue([]),
    listObservations:vi.fn(),listCityDemand:vi.fn(),
    listRights:vi.fn().mockResolvedValue([{
      id:'rights-1',asset_key:'playa-2',evidence_refs:['rights:playa-2'],
    }]),
    listLearning:vi.fn(),upsertProject:vi.fn(),upsertSong:vi.fn(),upsertExperiment:vi.fn(),
    recordObservation:vi.fn(),upsertCityDemand:vi.fn(),upsertRights:vi.fn(),upsertLearning:vi.fn(),
  };
}
function commissionRepo(){
  return {
    listPlatformAccounts:vi.fn(),listCatalogReleases:vi.fn(),listReceipts:vi.fn(),
    listRoyaltySnapshots:vi.fn(),listRoyaltyLines:vi.fn(),listVisualJobs:vi.fn(),
    upsertArtistProfile:vi.fn(),upsertPlatformAccount:vi.fn(),upsertCatalogRelease:vi.fn(),
    upsertReceipt:vi.fn(),upsertRoyaltySnapshot:vi.fn(),upsertRoyaltyLine:vi.fn(),
    upsertVisualJob:vi.fn().mockImplementation(async(input)=>({id:'visual:'+input.segmentId,...input})),
  };
}

describe('Music -> Director bridge',()=>{
  it('builds a music video master plus six derivative shorts from one source lineage',async()=>{
    const submitVideoJob=vi.fn().mockImplementation(async(input)=>({
      intent:{mode:'standard',prompt:input.activeTask,aspectRatio:'16:9',narration:false,captions:false,foley:true,commercialSafeOnly:true,providerPolicy:{localFreeFirst:true,allowPaidWithoutApproval:false}},
      job:{
        id:'video:'+submitVideoJob.mock.calls.length,clientRequestId:input.clientRequestId,userId:'user-1',
        projectId:input.activeProject,productionRunId:'run',source:'ask-jhadina',prompt:input.activeTask,
        mode:'standard',aspectRatio:'16:9',status:'submitted',currentPhase:'generation',
        outputAssetIds:[],createdAt:'2026-09-30T20:00:00-07:00',updatedAt:'2026-09-30T20:00:00-07:00',
      },
    }));
    const result=await createMusicDirectorPackage({
      userId:'user-1',songKey:'playa-2',deliverable:'music_video',
      audioAssetId:'audio:playa-2',audioUri:'https://signed.example/audio.mp3',audioDurationSeconds:180,
      vocalStemAssetId:'vocal:playa-2',vocalStemUri:'https://signed.example/vocal.wav',
      timedLyrics:[
        {id:'l1',startMs:0,endMs:6000,text:'line one'},
        {id:'l2',startMs:6000,endMs:12000,text:'line two'},
      ],
      artistReferenceAssets:[{id:'artist:1',uri:'https://signed.example/artist.jpg'}],
      styleReferenceAssets:[{id:'style:1',uri:'https://signed.example/style.jpg'}],
      concept:'cinematic performance story',lipSyncRequested:true,characterPerformanceRequested:true,
      submit:true,
    },{
      musicRepository:musicRepo(),
      commissionRepository:commissionRepo(),
      submitVideoJob,
    });
    expect(result.plan.status).toBe('READY');
    expect(result.plan.segments).toHaveLength(7);
    expect(result.jobs).toHaveLength(7);
    expect(result.externalPublishStarted).toBe(false);
    expect(result.paidGenerationAuthorized).toBe(false);
  });

  it('persists data-required lineage instead of submitting when timed lyrics are missing',async()=>{
    const submitVideoJob=vi.fn();
    const result=await createMusicDirectorPackage({
      userId:'user-1',songKey:'playa-2',deliverable:'lyric_video',
      audioAssetId:'audio:playa-2',audioUri:'https://signed.example/audio.mp3',audioDurationSeconds:180,
      concept:'kinetic lyric typography',timedLyrics:[],submit:true,
    },{
      musicRepository:musicRepo(),
      commissionRepository:commissionRepo(),
      submitVideoJob,
    });
    expect(result.plan.status).toBe('DATA_REQUIRED');
    expect(submitVideoJob).not.toHaveBeenCalled();
    expect(result.providerExecutionAttempted).toBe(false);
  });
});
